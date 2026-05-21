import { createEndpointRuntime } from './internal/endpoint-runtime'
import { createStreamWirings } from './internal/stream'
import { createPersistentPort } from './internal/persistent-port'
import browser from 'webextension-polyfill'

// Chrome API types for sidepanel
declare global {
  interface Chrome {
    sidePanel?: {
      setPanelBehavior: (options: { openPanelOnActionClick: boolean }) => void
      setOptions: (options: { path?: string }) => void
      onShown: {
        addListener: (callback: () => void) => void
        removeListener: (callback: () => void) => void
        hasListener: (callback: () => void) => boolean
      }
      onHidden: {
        addListener: (callback: () => void) => void
        removeListener: (callback: () => void) => void
        hasListener: (callback: () => void) => boolean
      }
      // V3 还支持指定页面的侧边栏配置
      getOptions: (options: { tabId?: number }) => Promise<{ path?: string }>
    }
  }
  var chrome: Chrome | undefined
}

const port = createPersistentPort('sidepanel')
const endpointRuntime = createEndpointRuntime(
  'sidepanel',
  message => port.postMessage(message),
)

port.onMessage(endpointRuntime.handleMessage)

/**
 * Set up Chrome's sidepanel API for Manifest V3 extensions
 *
 * This function initializes the Chrome sidepanel API and configures its behavior.
 * Use this in your sidepanel entry point to ensure the sidepanel works correctly.
 *
 * Example usage in your sidepanel script:
 *
 * ```ts
 * import { setupSidepanel, sendMessage } from 'webext-bridge/sidepanel'
 *
 * // Initialize the sidepanel
 * setupSidepanel({ defaultPath: 'sidepanel.html' })
 *
 * // Send a message to background
 * sendMessage('get-data', { key: 'value' }, 'background')
 *   .then(response => console.log(response))
 *
 * // Listen for messages from other contexts
 * onMessage('update-sidebar', (message) => {
 *   console.log(message.data)
 *   // Update sidebar UI
 * })
 * ```
 *
 * @param options Configuration options for the sidepanel
 * @param options.defaultPath Default HTML path for the sidepanel
 */
export function setupSidepanel(options: { defaultPath?: string } = {}) {
  if (typeof chrome !== 'undefined' && chrome.sidePanel) {
    // Chrome specific sidepanel API
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

    if (options.defaultPath) {
      chrome.sidePanel.setOptions({ path: options.defaultPath })
    }
  }
}

/**
 * 注册侧边栏显示事件的回调函数
 * @param callback 当侧边栏显示时要执行的回调函数
 * @returns 用于移除事件监听器的函数
 */
export function onSidepanelShown(callback: () => void): () => void {
  if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.onShown) {
    chrome.sidePanel.onShown.addListener(callback)
    return () => chrome.sidePanel.onShown.removeListener(callback)
  }
  return () => {}
}

/**
 * 注册侧边栏隐藏事件的回调函数
 * @param callback 当侧边栏隐藏时要执行的回调函数
 * @returns 用于移除事件监听器的函数
 */
export function onSidepanelHidden(callback: () => void): () => void {
  if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.onHidden) {
    chrome.sidePanel.onHidden.addListener(callback)
    return () => chrome.sidePanel.onHidden.removeListener(callback)
  }
  return () => {}
}

export function isSidepanelSupported(): boolean {
  return !!chrome.sidePanel
}


export const { sendMessage, onMessage } = endpointRuntime
export const { openStream, onOpenStreamChannel } = createStreamWirings(endpointRuntime)
