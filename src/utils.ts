import browser from 'webextension-polyfill'
import { Endpoint, RuntimeContext } from './types'

const ENDPOINT_RE = /^((?:background$)|devtools|content-script|window)(?:@(\d+))?$/

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
