import browser, { Manifest } from 'webextension-polyfill'
import { Endpoint, RuntimeContext } from './types'

const ENDPOINT_RE = /^((?:background$)|devtools|popup|options|content-script|window|web_accessible)(?:@(\d+)(?:\.(\d+))?)?$/

export const parseEndpoint = (endpoint: string): Endpoint => {
  const [, context, tabId, frameId] = endpoint.match(ENDPOINT_RE) || []

  return {
    context: context as RuntimeContext,
    tabId: +tabId,
    frameId: frameId ? +frameId : undefined,
  }
}

export const isInternalEndpoint = ({ context: ctx }: Endpoint): boolean => ['content-script', 'background', 'devtools', 'web_accessible'].includes(ctx)

// Return true if the `browser` object has a specific namespace
export const hasAPI = (nsps: string): boolean => browser[nsps]

export const getBackgroundPageType = () => {
  const manifest: Manifest.WebExtensionManifest = browser.runtime.getManifest()

  if (typeof window === 'undefined') return 'background'

  const popupPage = manifest.browser_action?.default_popup || manifest.action?.default_popup
  if (popupPage) {
    const url = new URL(browser.runtime.getURL(popupPage))
    if (url.pathname === window.location.pathname) return 'popup'
  }

  if (manifest.options_ui?.page) {
    const url = new URL(browser.runtime.getURL(manifest.options_ui.page))
    if (url.pathname === window.location.pathname) return 'options'
  }

  const webAccessibleResources = manifest.web_accessible_resources
  // manifest v2
  if (typeof webAccessibleResources?.[0] === 'string') {
    const urls = webAccessibleResources.map(resource => new URL(browser.runtime.getURL(resource)))
    if (urls.find(url => url.pathname === window.location.pathname)) return 'web_accessible'
  }
  else {
    // manifest v3
    const urlPatterns: string[] = webAccessibleResources.map(entry => entry.resources).flat(1)
    const patternsToRegex = urlPatterns.map(pattern => pattern.replace(/\*/g, '[^ ]*'))

    // try to match the current url with a pattern from "web_accessible_resources"
    if (patternsToRegex.find(pattern => window.location.pathname.replace(/^\//, '').match(new RegExp(`^${pattern}`)))) return 'web_accessible'
  }

  return 'background'
}
