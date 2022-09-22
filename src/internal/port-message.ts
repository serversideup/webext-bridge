import type { Runtime } from 'webextension-polyfill'
import type { InternalMessage } from '../types'
import type { DeliveryReceipt } from './delivery-logger'
import type { EndpointFingerprint } from './endpoint-fingerprint'

export type StatusMessage =
  | {
    status: 'undeliverable'
    message: InternalMessage
    resolvedDestination: string
  }
  | {
    status: 'deliverable'
    deliverableTo: string
  }
  | {
    status: 'delivered'
    receipt: DeliveryReceipt
  }
  | {
    status: 'incoming'
    message: InternalMessage
  }
  | {
    status: 'terminated'
    fingerprint: EndpointFingerprint
  }

export type RequestMessage =
  | {
    type: 'sync'
    pendingResponses: ReadonlyArray<DeliveryReceipt>
    pendingDeliveries: ReadonlyArray<string>
  }
  | {
    type: 'deliver'
    message: InternalMessage
  }

export class PortMessage {
  static toBackground(port: Runtime.Port, message: RequestMessage) {
    return port.postMessage(message)
  }

  static toExtensionContext(port: Runtime.Port, message: StatusMessage) {
    return port.postMessage(message)
  }
}
