import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import type { IInternalMessage } from './types'
import { createEndpointRuntime } from './internal/endpoint-runtime'
import { formatEndpoint, parseEndpoint } from './internal/endpoint'
import { createStreamWirings } from './internal/stream'

interface IQueuedMessage {
  resolvedDestination: string
  message: IInternalMessage
}

const messageQueue = new Set<IQueuedMessage>()
const portMap = new Map<string, Runtime.Port>()

const endpointRuntime = createEndpointRuntime(
  'background',
  (message) => {
    if (message.origin.context === 'background' && message.destination.context !== 'background' && !message.destination.tabId)
      throw new TypeError('When sending messages from background page, use @tabId syntax to target specific tab')

    const { context: destName, tabId: destTabId, frameId: destFrameId } = message.destination
    const { tabId: srcTabId } = message.origin

    // downstream endpoints are agnostic of these attributes, presence of these attrs will make them think the message is not intended for them
    message.destination.tabId = null
    message.destination.frameId = null

    let resolvedDestination = ['popup', 'options'].includes(destName)
      ? destName
      : `${(destName === 'window' ? 'content-script' : destName)}@${(destTabId || srcTabId)}`

    // Here it is checked if a specific frame needs to receive the message
    if (destFrameId)
      resolvedDestination = `${resolvedDestination}.${destFrameId}`

    const destPort = portMap.get(resolvedDestination)

    if (destPort) destPort.postMessage(message)
    else messageQueue.add({ resolvedDestination, message })
  },
)

browser.runtime.onConnect.addListener((incomingPort) => {
  // all other contexts except 'content-script' are aware of, and pass their identity as name
  const portId = incomingPort.name || formatEndpoint({
    context: 'content-script',
    tabId: incomingPort.sender.tab.id,
    frameId: incomingPort.sender.frameId,
  })

  // literal tab id in case of content script, however tab id of inspected page in case of devtools context
  const { context, tabId: linkedTabId, frameId: linkedFrameId } = parseEndpoint(portId)

  // in-case the port handshake is from something else
  if (!linkedTabId && context !== 'popup' && context !== 'options')
    return

  portMap.set(portId, incomingPort)

  messageQueue.forEach((queuedMsg) => {
    if (queuedMsg.resolvedDestination === portId) {
      incomingPort.postMessage(queuedMsg.message)
      messageQueue.delete(queuedMsg)
    }
  })

  incomingPort.onDisconnect.addListener(() => {
    // sometimes previous content script's onDisconnect is called *after* the fresh content-script's
    // onConnect. So without this reference equality check, we would remove the new port from map
    if (portMap.get(portId) === incomingPort)
      portMap.delete(portId)
  })

  incomingPort.onMessage.addListener((message: IInternalMessage) => {
    if (message?.origin?.context) {
      // origin tab ID is resolved from the port identifier (also prevent "MITM attacks" of extensions)
      message.origin.tabId = linkedTabId
      message.origin.frameId = linkedFrameId

      endpointRuntime.handleMessage(message)
    }
  })
})

export const { sendMessage, onMessage } = endpointRuntime
export const { openStream, onOpenStreamChannel } = createStreamWirings(endpointRuntime)
