export { Stream } from './Stream'
export * from './Bridge'
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
