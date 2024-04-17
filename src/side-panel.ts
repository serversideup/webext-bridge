import { createEndpointRuntime } from './internal/endpoint-runtime'
import { createStreamWirings } from './internal/stream'
import { createPersistentPort } from './internal/persistent-port'

const port = createPersistentPort('side-panel')
const endpointRuntime = createEndpointRuntime(
  'side-panel',
  message => port.postMessage(message),
)

port.onMessage(endpointRuntime.handleMessage)

export const { sendMessage, onMessage } = endpointRuntime
export const { openStream, onOpenStreamChannel } = createStreamWirings(endpointRuntime)
