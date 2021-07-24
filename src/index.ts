export { Stream } from './stream'
export * from './bridge'
export * from './types'

export {
  allowWindowMessaging,
  setNamespace,
  getCurrentContext,
} from './internal'

export {
  parseEndpoint,
  isInternalEndpoint,
} from './utils'

export {
  sendMessage,
  onMessage,
} from './apis'
