import { createNanoEvents } from 'nanoevents'
import uuid from 'tiny-uid'
import type { Emitter } from 'nanoevents'
import type { JsonValue } from 'type-fest'
import type { Endpoint, HybridUnsubscriber, RuntimeContext, StreamInfo } from '../types'
import type { EndpointRuntime } from './endpoint-runtime'
import { parseEndpoint } from './parse-endpoint'

/**
 * Built on top of Bridge. Nothing much special except that Stream allows
 * you to create a namespaced scope under a channel name of your choice
 * and allows continuous e2e communication, with less possibility of
 * conflicting messageId's, since streams are strictly scoped.
 */
export class Stream {
  private static initDone = false
  private static openStreams: Map<string, Stream> = new Map()

  private emitter: Emitter = createNanoEvents()
  private isClosed = false
  constructor(private endpointRuntime: EndpointRuntime, private streamInfo: StreamInfo) {
    if (!Stream.initDone) {
      endpointRuntime.onMessage<{ streamId: string; action: 'transfer' | 'close'; streamTransfer: JsonValue }, string>('__crx_bridge_stream_transfer__', (msg) => {
        const { streamId, streamTransfer, action } = msg.data
        const stream = Stream.openStreams.get(streamId)
        if (stream && !stream.isClosed) {
          if (action === 'transfer')
            stream.emitter.emit('message', streamTransfer)

          if (action === 'close') {
            Stream.openStreams.delete(streamId)
            stream.handleStreamClose()
          }
        }
      })
      Stream.initDone = true
    }

    Stream.openStreams.set(this.streamInfo.streamId, this)
  }

  /**
   * Returns stream info
   */
  public get info(): StreamInfo {
    return this.streamInfo
  }

  /**
   * Sends a message to other endpoint.
   * Will trigger onMessage on the other side.
   *
   * Warning: Before sending sensitive data, verify the endpoint using `stream.info.endpoint.isInternal()`
   * The other side could be malicious webpage speaking same language as webext-bridge
   * @param msg
   */
  public send(msg?: JsonValue): void {
    if (this.isClosed)
      throw new Error('Attempting to send a message over closed stream. Use stream.onClose(<callback>) to keep an eye on stream status')

    this.endpointRuntime.sendMessage('__crx_bridge_stream_transfer__', {
      streamId: this.streamInfo.streamId,
      streamTransfer: msg,
      action: 'transfer',
    }, this.streamInfo.endpoint)
  }

  /**
   * Closes the stream.
   * Will trigger stream.onClose(<callback>) on both endpoints.
   * If needed again, spawn a new Stream, as this instance cannot be re-opened
   * @param msg
   */
  public close(msg?: JsonValue): void {
    if (msg)
      this.send(msg)

    this.handleStreamClose()

    this.endpointRuntime.sendMessage('__crx_bridge_stream_transfer__', {
      streamId: this.streamInfo.streamId,
      streamTransfer: null,
      action: 'close',
    }, this.streamInfo.endpoint)
  }

  /**
   * Registers a callback to fire whenever other endpoint sends a message
   * @param callback
   */
  public onMessage<T extends JsonValue>(callback: (msg?: T) => void): HybridUnsubscriber {
    return this.getDisposable('message', callback)
  }

  /**
   * Registers a callback to fire whenever stream.close() is called on either endpoint
   * @param callback
   */
  public onClose<T extends JsonValue>(callback: (msg?: T) => void): HybridUnsubscriber {
    return this.getDisposable('closed', callback)
  }

  private handleStreamClose = () => {
    if (!this.isClosed) {
      this.isClosed = true
      this.emitter.emit('closed', true)
      this.emitter.events = {}
    }
  }

  private getDisposable(event: string, callback: () => void): HybridUnsubscriber {
    const off = this.emitter.on(event, callback)

    return Object.assign(off, {
      dispose: off,
      close: off,
    })
  }
}

export const createStreamWirings = (endpointRuntime: EndpointRuntime) => {
  const openStreams = new Map<string, Stream>()
  const onOpenStreamCallbacks = new Map<string, (stream: Stream) => void>()
  const streamyEmitter = createNanoEvents()

  endpointRuntime.onMessage<{ channel: string; streamId: string }, string>('__crx_bridge_stream_open__', (message) => {
    return new Promise((resolve) => {
      const { sender, data } = message
      const { channel } = data
      let watching = false
      let off = () => { }

      const readyup = () => {
        const callback = onOpenStreamCallbacks.get(channel)

        if (typeof callback === 'function') {
          callback(new Stream(endpointRuntime, { ...data, endpoint: sender }))
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

  async function openStream(channel: string, destination: RuntimeContext | Endpoint | string): Promise<Stream> {
    if (openStreams.has(channel))
      throw new Error('webext-bridge: A Stream is already open at this channel')

    const endpoint = typeof destination === 'string' ? parseEndpoint(destination) : destination

    const streamInfo: StreamInfo = { streamId: uuid(), channel, endpoint }
    const stream = new Stream(endpointRuntime, streamInfo)
    stream.onClose(() => openStreams.delete(channel))
    await endpointRuntime.sendMessage('__crx_bridge_stream_open__', streamInfo as unknown as JsonValue, endpoint)
    openStreams.set(channel, stream)
    return stream
  }

  function onOpenStreamChannel(channel: string, callback: (stream: Stream) => void): void {
    if (onOpenStreamCallbacks.has(channel))
      throw new Error('webext-bridge: This channel has already been claimed. Stream allows only one-on-one communication')

    onOpenStreamCallbacks.set(channel, callback)
    streamyEmitter.emit('did-change-stream-callbacks')
  }

  return {
    openStream,
    onOpenStreamChannel,
  }
}
