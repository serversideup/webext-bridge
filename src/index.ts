export { Stream } from './stream'
export * from './bridge'
export * from './types'

export {
  allowWindowMessaging,
  setNamespace,
} from './internal'
export {
  parseEndpoint,
  isInternalEndpoint,
} from './utils'

export {
  sendMessage,
} from './apis/sendMessage'

export {
  onMessage,
} from './apis/onMessage'
