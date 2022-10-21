import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import type { InternalMessage } from '../types'
import { createFingerprint } from './endpoint-fingerprint'
import type { QueuedMessage } from './types'
import { encodeConnectionArgs } from './connection-args'
import { createDeliveryLogger } from './delivery-logger'
import type { StatusMessage } from './port-message'
import { PortMessage } from './port-message'

/**
 * Manfiest V3 extensions can have their service worker terminated at any point
 * by the browser. That termination of service worker also terminates any messaging
 * porta created by other parts of the extension. This class is a wrapper around the
 * built-in Port object that re-instantiates the port connection everytime it gets
 * suspended
 */
export const createPersistentPort = (name = '') => {
  const fingerprint = createFingerprint()
  let port: Runtime.Port
  let undeliveredQueue: ReadonlyArray<QueuedMessage> = []
  const pendingResponses = createDeliveryLogger()
  const onMessageListeners = new Set<
  (message: InternalMessage, port: Runtime.Port) => void
  >()
  const onFailureListeners = new Set<(message: InternalMessage) => void>()

  const handleMessage = (msg: StatusMessage, port: Runtime.Port) => {
    switch (msg.status) {
      case 'undeliverable':
        if (
          !undeliveredQueue.some(
            m => m.message.messageID === msg.message.messageID,
          )
        ) {
          undeliveredQueue = [
            ...undeliveredQueue,
            {
              message: msg.message,
              resolvedDestination: msg.resolvedDestination,
            },
          ]
        }

        return

      case 'deliverable':
        undeliveredQueue = undeliveredQueue.reduce((acc, queuedMsg) => {
          if (queuedMsg.resolvedDestination === msg.deliverableTo) {
            PortMessage.toBackground(port, {
              type: 'deliver',
              message: queuedMsg.message,
            })

            return acc
          }

          return [...acc, queuedMsg]
        }, [] as ReadonlyArray<QueuedMessage>)

        return

      case 'delivered':
        if (msg.receipt.message.messageType === 'message')
          pendingResponses.add(msg.receipt)

        return

      case 'incoming':
        if (msg.message.messageType === 'reply')
          pendingResponses.remove(msg.message.messageID)

        onMessageListeners.forEach(cb => cb(msg.message, port))

        return

      case 'terminated': {
        const rogueMsgs = pendingResponses
          .entries()
          .filter(receipt => msg.fingerprint === receipt.to)
        pendingResponses.remove(rogueMsgs)
        rogueMsgs.forEach(({ message }) =>
          onFailureListeners.forEach(cb => cb(message)),
        )
      }
    }
  }

  const connect = () => {
    port = browser.runtime.connect({
      name: encodeConnectionArgs({
        endpointName: name,
        fingerprint,
      }),
    })
    port.onMessage.addListener(handleMessage)
    port.onDisconnect.addListener(connect)

    PortMessage.toBackground(port, {
      type: 'sync',
      pendingResponses: pendingResponses.entries(),
      pendingDeliveries: [
        ...new Set(
          undeliveredQueue.map(({ resolvedDestination }) => resolvedDestination),
        ),
      ],
    })
  }

  window.onpageshow = (event) => {
    if (event.persisted) connect()
  }

  connect()

  return {
    onFailure(cb: (message: InternalMessage) => void) {
      onFailureListeners.add(cb)
    },
    onMessage(cb: (message: InternalMessage) => void): void {
      onMessageListeners.add(cb)
    },
    postMessage(message: any): void {
      PortMessage.toBackground(port, {
        type: 'deliver',
        message,
      })
    },
  }
}
