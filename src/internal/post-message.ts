import type { IInternalMessage } from '../types'

export const usePostMessaging = (thisContext: 'window' | 'content-script') => {
  let allocatedNamespace: string
  let messagingEnabled = false
  let onMessageCallback: (msg: IInternalMessage) => void

  window.addEventListener('message', (event) => {
    if (!messagingEnabled)
      return

    const { data, ports } = event

    if (data.scope !== allocatedNamespace || data.context === thisContext)
      return

    switch (data.cmd) {
      case '__crx_bridge_verify_listening': {
        const msgPort: MessagePort = ports[0]
        msgPort.postMessage(true)
        break
      }

      case '__crx_bridge_message': {
        const { payload } = data

        onMessageCallback?.(payload)
        break
      }
    }
  })

  const postMessage = (msg: IInternalMessage) => {
    if (!messagingEnabled)
      return

    if (thisContext !== 'content-script' && thisContext !== 'window')
      throw new Error('Endpoint does not use postMessage')

    ensureNamespaceSet(allocatedNamespace)

    const channel = new MessageChannel()
    const retry = setTimeout(() => {
      channel.port1.onmessage = null
      postMessage(msg)
    }, 300)

    channel.port1.onmessage = () => {
      clearTimeout(retry)
      window.postMessage({
        cmd: '__crx_bridge_message',
        scope: allocatedNamespace,
        context: thisContext,
        payload: msg,
      }, '*')
    }

    window.postMessage({
      cmd: '__crx_bridge_verify_listening',
      scope: allocatedNamespace,
      context: thisContext,
    }, '*', [channel.port2])
  }

  return {
    postMessage,
    enable: () => messagingEnabled = true,
    setNamespace: (nsps: string) => allocatedNamespace = nsps,
    onMessage: (cb: typeof onMessageCallback) => onMessageCallback = cb,
  }
}

function ensureNamespaceSet(namespace: string) {
  if (typeof namespace !== 'string' || namespace.length === 0) {
    throw new Error(
      'webext-bridge uses window.postMessage to talk with other "window"(s), for message routing and stuff,'
      + 'which is global/conflicting operation in case there are other scripts using webext-bridge. '
      + 'Call Bridge#setNamespace(nsps) to isolate your app. Example: setNamespace(\'com.facebook.react-devtools\'). '
      + 'Make sure to use same namespace across all your scripts whereever window.postMessage is likely to be used`',
    )
  }
}
