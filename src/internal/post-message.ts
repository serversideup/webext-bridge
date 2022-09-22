import type { InternalMessage } from '../types'
import { getMessagePort } from './message-port'

export interface EndpointWontRespondError {
  type: 'error'
  transactionID: string
}

export const usePostMessaging = (thisContext: 'window' | 'content-script') => {
  let allocatedNamespace: string
  let messagingEnabled = false
  let onMessageCallback: (
    msg: InternalMessage | EndpointWontRespondError
  ) => void
  let portP: Promise<MessagePort>

  return {
    enable: () => (messagingEnabled = true),
    onMessage: (cb: typeof onMessageCallback) => (onMessageCallback = cb),
    postMessage: async(msg: InternalMessage | EndpointWontRespondError) => {
      if (thisContext !== 'content-script' && thisContext !== 'window')
        throw new Error('Endpoint does not use postMessage')

      if (!messagingEnabled)
        throw new Error('Communication with window has not been allowed')

      ensureNamespaceSet(allocatedNamespace)

      return (await portP).postMessage(msg)
    },
    setNamespace: (nsps: string) => {
      if (allocatedNamespace)
        throw new Error('Namespace once set cannot be changed')

      allocatedNamespace = nsps
      portP = getMessagePort(thisContext, nsps, ({ data }) =>
        onMessageCallback?.(data),
      )
    },
  }
}

function ensureNamespaceSet(namespace: string) {
  if (typeof namespace !== 'string' || namespace.trim().length === 0) {
    throw new Error(
      'webext-bridge uses window.postMessage to talk with other "window"(s) for message routing'
        + 'which is global/conflicting operation in case there are other scripts using webext-bridge. '
        + 'Call Bridge#setNamespace(nsps) to isolate your app. Example: setNamespace(\'com.facebook.react-devtools\'). '
        + 'Make sure to use same namespace across all your scripts whereever window.postMessage is likely to be used`',
    )
  }
}
