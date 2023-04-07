import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import { createEndpointRuntime } from './internal/endpoint-runtime'
import { formatEndpoint, parseEndpoint } from './internal/endpoint'
import { createStreamWirings } from './internal/stream'
import type { EndpointFingerprint } from './internal/endpoint-fingerprint'
import { createFingerprint } from './internal/endpoint-fingerprint'
import { decodeConnectionArgs } from './internal/connection-args'
import type { DeliveryReceipt } from './internal/delivery-logger'
import { createDeliveryLogger } from './internal/delivery-logger'
import type { RequestMessage } from './internal/port-message'
import { PortMessage } from './internal/port-message'
import type { InternalMessage } from './types'

interface PortConnection {
  port: Runtime.Port
  fingerprint: EndpointFingerprint
}

const pendingResponses = createDeliveryLogger()
const connMap = new Map<string, PortConnection>()
const oncePortConnectedCbs = new Map<string, Set<() => void>>()
const onceSessionEndCbs = new Map<EndpointFingerprint, Set<() => void>>()

const oncePortConnected = (endpointName: string, cb: () => void) => {
  oncePortConnectedCbs.set(
    endpointName,
    (oncePortConnectedCbs.get(endpointName) || new Set()).add(cb),
  )

  return () => {
    const su = oncePortConnectedCbs.get(endpointName)
    if (su?.delete(cb) && su?.size === 0)
      oncePortConnectedCbs.delete(endpointName)
  }
}

const onceSessionEnded = (
  sessionFingerprint: EndpointFingerprint,
  cb: () => void,
) => {
  onceSessionEndCbs.set(
    sessionFingerprint,
    (onceSessionEndCbs.get(sessionFingerprint) || new Set()).add(cb),
  )
}

const notifyEndpoint = (endpoint: string) => ({
  withFingerprint: (fingerprint: EndpointFingerprint) => {
    const nextChain = <T>(v: T) => ({ and: () => v })

    const notifications = {
      aboutIncomingMessage: (message: InternalMessage) => {
        const recipient = connMap.get(endpoint)

        PortMessage.toExtensionContext(recipient.port, {
          status: 'incoming',
          message,
        })

        return nextChain(notifications)
      },

      aboutSuccessfulDelivery: (receipt: DeliveryReceipt) => {
        const sender = connMap.get(endpoint)
        PortMessage.toExtensionContext(sender.port, {
          status: 'delivered',
          receipt,
        })

        return nextChain(notifications)
      },

      aboutMessageUndeliverability: (
        resolvedDestination: string,
        message: InternalMessage,
      ) => {
        const sender = connMap.get(endpoint)
        if (sender?.fingerprint === fingerprint) {
          PortMessage.toExtensionContext(sender.port, {
            status: 'undeliverable',
            resolvedDestination,
            message,
          })
        }

        return nextChain(notifications)
      },

      whenDeliverableTo: (targetEndpoint: string) => {
        const notifyDeliverability = () => {
          const origin = connMap.get(endpoint)
          if (
            origin?.fingerprint === fingerprint
            && connMap.has(targetEndpoint)
          ) {
            PortMessage.toExtensionContext(origin.port, {
              status: 'deliverable',
              deliverableTo: targetEndpoint,
            })

            return true
          }
        }

        if (!notifyDeliverability()) {
          const unsub = oncePortConnected(targetEndpoint, notifyDeliverability)
          onceSessionEnded(fingerprint, unsub)
        }

        return nextChain(notifications)
      },

      aboutSessionEnded: (endedSessionFingerprint: EndpointFingerprint) => {
        const conn = connMap.get(endpoint)
        if (conn?.fingerprint === fingerprint) {
          PortMessage.toExtensionContext(conn.port, {
            status: 'terminated',
            fingerprint: endedSessionFingerprint,
          })
        }

        return nextChain(notifications)
      },
    }

    return notifications
  },
})

const sessFingerprint = createFingerprint()

const endpointRuntime = createEndpointRuntime(
  'background',
  (message) => {
    if (
      message.origin.context === 'background'
      && ['content-script', 'devtools '].includes(message.destination.context)
      && !message.destination.tabId
    ) {
      throw new TypeError(
        'When sending messages from background page, use @tabId syntax to target specific tab',
      )
    }

    const resolvedSender = formatEndpoint({
      ...message.origin,
      ...(message.origin.context === 'window' && { context: 'content-script' }),
    })

    const resolvedDestination = formatEndpoint({
      ...message.destination,
      ...(message.destination.context === 'window' && {
        context: 'content-script',
      }),
      tabId: message.destination.tabId || message.origin.tabId,
    })

    // downstream endpoints are agnostic of these attributes, presence of these attrs will make them think the message is not intended for them
    message.destination.tabId = null
    message.destination.frameId = null

    const dest = () => connMap.get(resolvedDestination)
    const sender = () => connMap.get(resolvedSender)

    const deliver = () => {
      notifyEndpoint(resolvedDestination)
        .withFingerprint(dest().fingerprint)
        .aboutIncomingMessage(message)

      const receipt: DeliveryReceipt = {
        message,
        to: dest().fingerprint,
        from: {
          endpointId: resolvedSender,
          fingerprint: sender()?.fingerprint,
        },
      }

      if (message.messageType === 'message') pendingResponses.add(receipt)

      if (message.messageType === 'reply')
        pendingResponses.remove(message.messageID)

      if (sender()) {
        notifyEndpoint(resolvedSender)
          .withFingerprint(sender().fingerprint)
          .aboutSuccessfulDelivery(receipt)
      }
    }

    if (dest()?.port) {
      deliver()
    }
    else if (message.messageType === 'message') {
      if (message.origin.context === 'background') {
        oncePortConnected(resolvedDestination, deliver)
      }
      else if (sender()) {
        notifyEndpoint(resolvedSender)
          .withFingerprint(sender().fingerprint)
          .aboutMessageUndeliverability(resolvedDestination, message)
          .and()
          .whenDeliverableTo(resolvedDestination)
      }
    }
  },
  (message) => {
    const resolvedSender = formatEndpoint({
      ...message.origin,
      ...(message.origin.context === 'window' && { context: 'content-script' }),
    })

    const sender = connMap.get(resolvedSender)

    const receipt: DeliveryReceipt = {
      message,
      to: sessFingerprint,
      from: {
        endpointId: resolvedSender,
        fingerprint: sender.fingerprint,
      },
    }

    notifyEndpoint(resolvedSender)
      .withFingerprint(sender.fingerprint)
      .aboutSuccessfulDelivery(receipt)
  },
)

browser.runtime.onConnect.addListener((incomingPort) => {
  const connArgs = decodeConnectionArgs(incomingPort.name)

  if (!connArgs) return

  // all other contexts except 'content-script' are aware of, and pass their identity as name
  connArgs.endpointName ||= formatEndpoint({
    context: 'content-script',
    tabId: incomingPort.sender.tab.id,
    frameId: incomingPort.sender.frameId,
  })

  // literal tab id in case of content script, however tab id of inspected page in case of devtools context
  const { tabId: linkedTabId, frameId: linkedFrameId } = parseEndpoint(
    connArgs.endpointName,
  )

  connMap.set(connArgs.endpointName, {
    fingerprint: connArgs.fingerprint,
    port: incomingPort,
  })

  oncePortConnectedCbs.get(connArgs.endpointName)?.forEach(cb => cb())
  oncePortConnectedCbs.delete(connArgs.endpointName)

  onceSessionEnded(connArgs.fingerprint, () => {
    const rogueMsgs = pendingResponses
      .entries()
      .filter(pendingMessage => pendingMessage.to === connArgs.fingerprint)
    pendingResponses.remove(rogueMsgs)

    rogueMsgs.forEach((rogueMessage) => {
      if (rogueMessage.from.endpointId === 'background') {
        endpointRuntime.endTransaction(rogueMessage.message.transactionId)
      }
      else {
        notifyEndpoint(rogueMessage.from.endpointId)
          .withFingerprint(rogueMessage.from.fingerprint)
          .aboutSessionEnded(connArgs.fingerprint)
      }
    })
  })

  incomingPort.onDisconnect.addListener(() => {
    // sometimes previous content script's onDisconnect is called *after* the fresh content-script's
    // onConnect. So without this fingerprint equality check, we would remove the new port from map
    if (
      connMap.get(connArgs.endpointName)?.fingerprint === connArgs.fingerprint
    )
      connMap.delete(connArgs.endpointName)

    onceSessionEndCbs.get(connArgs.fingerprint)?.forEach(cb => cb())
    onceSessionEndCbs.delete(connArgs.fingerprint)
  })

  incomingPort.onMessage.addListener((msg: RequestMessage) => {
    if (msg.type === 'sync') {
      const allActiveSessions = [...connMap.values()].map(
        conn => conn.fingerprint,
      )
      const stillPending = msg.pendingResponses.filter(fp =>
        allActiveSessions.includes(fp.to),
      )

      pendingResponses.add(...stillPending)

      msg.pendingResponses
        .filter(
          deliveryReceipt => !allActiveSessions.includes(deliveryReceipt.to),
        )
        .forEach(deliveryReceipt =>
          notifyEndpoint(connArgs.endpointName)
            .withFingerprint(connArgs.fingerprint)
            .aboutSessionEnded(deliveryReceipt.to),
        )

      msg.pendingDeliveries.forEach(intendedDestination =>
        notifyEndpoint(connArgs.endpointName)
          .withFingerprint(connArgs.fingerprint)
          .whenDeliverableTo(intendedDestination),
      )

      return
    }

    if (msg.type === 'deliver' && msg.message?.origin?.context) {
      // origin tab ID is resolved from the port identifier (also prevent "MITM attacks" of extensions)
      msg.message.origin.tabId = linkedTabId
      msg.message.origin.frameId = linkedFrameId

      endpointRuntime.handleMessage(msg.message)
    }
  })
})

export const { sendMessage, onMessage } = endpointRuntime
export const { openStream, onOpenStreamChannel }
  = createStreamWirings(endpointRuntime)
