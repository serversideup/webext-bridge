import uuid from 'tiny-uuid'

import { createNanoEvents } from 'nanoevents'
import { StreamInfo, Stream } from './Stream'
import {
  IBridgeMessage,
  OnMessageCallback,
  sendMessage,
  onMessage,
  allowWindowMessaging,
  setNamespace,
  Endpoint,
  parseEndpoint,
  isInternalEnpoint,
} from './internal'

const openStreams = new Map<string, Stream>()
const onOpenStreamCallbacks = new Map<string, (stream: Stream) => void>()
const streamyEmitter = createNanoEvents()

onMessage<{ channel: string; streamId: string }>('__crx_bridge_stream_open__', (message) => {
  return new Promise((resolve) => {
    const { sender, data } = message
    const { channel } = data
    let watching = false
    let off = () => {}

    const readyup = () => {
      const callback = onOpenStreamCallbacks.get(channel)

      if (typeof callback === 'function') {
        callback(new Stream({ ...data, endpoint: sender }))
        if (watching)
          off()

        resolve(true)
      }
      else if (!watching) {
        watching = true
        off = streamyEmitter.on('did-change-stream-callbacks', readyup)
      }
    }

    readyup()
  })
})

async function openStream(channel: string, destination: string | Endpoint): Promise<Stream> {
  if (openStreams.has(channel))
    throw new Error('webext-bridge: A Stream is already open at this channel')

  const endpoint = typeof destination === 'string' ? parseEndpoint(destination) : destination

  const streamInfo: StreamInfo = { streamId: uuid(), channel, endpoint }
  const stream = new Stream(streamInfo)
  stream.onClose(() => openStreams.delete(channel))
  await sendMessage('__crx_bridge_stream_open__', streamInfo, endpoint)
  openStreams.set(channel, stream)
  return stream
}

function onOpenStreamChannel(channel: string, callback: (stream: Stream) => void): void {
  if (onOpenStreamCallbacks.has(channel))
    throw new Error('webext-bridge: This channel has already been claimed. Stream allows only one-on-one communication')

  onOpenStreamCallbacks.set(channel, callback)
  streamyEmitter.emit('did-change-stream-callbacks')
}

export {
  IBridgeMessage,
  OnMessageCallback,
  isInternalEnpoint,
  sendMessage,
  onMessage,
  allowWindowMessaging,
  setNamespace,
  openStream,
  onOpenStreamChannel,
}
