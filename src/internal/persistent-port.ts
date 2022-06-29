import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'

/**
 * Manfiest V3 extensions can have their service worker terminated at any point
 * by the browser. That termination of service worker also terminates any messaging
 * porta created by other parts of the extension. This class is a wrapper around the
 * built-in Port object that re-instantiates the port connection everytime it gets
 * suspended
 */
export const createPersistentPort = (name = '') => {
  let port: Runtime.Port
  const onMessageListeners = new Set<(message: any, port: Runtime.Port) => void>()

  const invokeOnMessageListeners = (message: any, port: Runtime.Port) => {
    onMessageListeners.forEach(cb => cb(message, port))
  }

  const connect = () => {
    port = browser.runtime.connect({ name })
    port.onMessage.addListener(invokeOnMessageListeners)
    port.onDisconnect.addListener(connect)
  }

  connect()

  return {
    onMessage(cb: (message: any, port: Runtime.Port) => void): void {
      onMessageListeners.add(cb)
    },
    postMessage(message: any): void {
      port.postMessage(message)
    },
  }
}
