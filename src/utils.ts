import browser, { Manifest } from 'webextension-polyfill'
import { Endpoint, RuntimeContext } from './types'

const ENDPOINT_RE = /^((?:background$)|devtools|popup|options|content-script|window)(?:@(\d+))?$/

export const parseEndpoint = (endpoint: string): Endpoint => {
  const [, context, tabId] = endpoint.match(ENDPOINT_RE) || []

  return {
    context: context as RuntimeContext,
    tabId: +tabId,
  }
}

export const isInternalEndpoint = ({ context: ctx }: Endpoint): boolean => ['content-script', 'background', 'devtools'].includes(ctx)

// Return true if the `browser` object has a specific namespace
export const hasAPI = (nsps: string): boolean => browser[nsps]

export const getBackgroundPageType = () => {
  const manifest: Manifest.WebExtensionManifest = browser.runtime.getManifest()

  if (manifest.browser_action?.default_popup) {
    const url = new URL(browser.runtime.getURL(manifest.browser_action.default_popup))
    if (url.pathname === window.location.pathname) return 'popup'
  }

  if (manifest.options_ui?.page) {
    const url = new URL(browser.runtime.getURL(manifest.options_ui.page))
    if (url.pathname === window.location.pathname) return 'options'
  }

  return 'background'
}
