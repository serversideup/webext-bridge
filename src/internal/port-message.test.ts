import { PortMessage } from './port-message'
import type { Runtime } from 'webextension-polyfill'
import type { InternalMessage } from '../types'
import type { DeliveryReceipt } from './delivery-logger'
import type { EndpointFingerprint } from './endpoint-fingerprint'

describe('PortMessage', () => {
  let mockPort: jest.Mocked<Runtime.Port>

  beforeEach(() => {
    mockPort = {
      postMessage: jest.fn(),
      name: 'test-port',
      sender: undefined,
      disconnect: jest.fn(),
      onDisconnect: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListener: jest.fn(),
        hasListeners: jest.fn(),
      },
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListener: jest.fn(),
        hasListeners: jest.fn(),
      },
    } as unknown as jest.Mocked<Runtime.Port>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('toBackground', () => {
    it('should post a sync request message', () => {
      const message = {
        type: 'sync' as const,
        pendingResponses: [],
        pendingDeliveries: [],
      }

      PortMessage.toBackground(mockPort, message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
    })

    it('should post a sync request message with pending responses', () => {
      const internalMessage: InternalMessage = {
        origin: { context: 'content-script', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-123',
        hops: [],
        messageID: 'msg-123',
        messageType: 'message',
        timestamp: Date.now(),
      }
      const receipt1: DeliveryReceipt = {
        message: internalMessage,
        to: 'uid::fp1' as EndpointFingerprint,
        from: { endpointId: 'ep1', fingerprint: 'uid::fp1' as EndpointFingerprint },
      }
      const receipt2: DeliveryReceipt = {
        message: internalMessage,
        to: 'uid::fp2' as EndpointFingerprint,
        from: { endpointId: 'ep2', fingerprint: 'uid::fp2' as EndpointFingerprint },
      }
      const message = {
        type: 'sync' as const,
        pendingResponses: [receipt1, receipt2],
        pendingDeliveries: ['delivery1'],
      }

      PortMessage.toBackground(mockPort, message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
    })

    it('should post a deliver request message', () => {
      const internalMessage: InternalMessage = {
        origin: { context: 'content-script', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-456',
        hops: [],
        messageID: 'msg-456',
        messageType: 'message',
        data: { type: 'test' },
        timestamp: Date.now(),
      }
      const message = {
        type: 'deliver' as const,
        message: internalMessage,
      }

      PortMessage.toBackground(mockPort, message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
    })
  })

  describe('toExtensionContext', () => {
    it('should post an undeliverable status message', () => {
      const internalMessage: InternalMessage = {
        origin: { context: 'content-script', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-789',
        hops: [],
        messageID: 'msg-789',
        messageType: 'message',
        data: { type: 'test' },
        timestamp: Date.now(),
      }
      const message = {
        status: 'undeliverable' as const,
        message: internalMessage,
        resolvedDestination: 'background',
      }

      PortMessage.toExtensionContext(mockPort, message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
    })

    it('should post a deliverable status message', () => {
      const message = {
        status: 'deliverable' as const,
        deliverableTo: 'content-script',
      }

      PortMessage.toExtensionContext(mockPort, message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
    })

    it('should post a delivered status message', () => {
      const internalMessage: InternalMessage = {
        origin: { context: 'content-script', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-receipt',
        hops: [],
        messageID: 'msg-receipt',
        messageType: 'message',
        timestamp: Date.now(),
      }
      const receipt: DeliveryReceipt = {
        message: internalMessage,
        to: 'uid::fp123' as EndpointFingerprint,
        from: { endpointId: 'ep1', fingerprint: 'uid::fp123' as EndpointFingerprint },
      }
      const message = {
        status: 'delivered' as const,
        receipt,
      }

      PortMessage.toExtensionContext(mockPort, message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
    })

    it('should post an incoming status message', () => {
      const internalMessage: InternalMessage = {
        origin: { context: 'background', tabId: 0 },
        destination: { context: 'popup', tabId: 0 },
        transactionId: 'tx-incoming',
        hops: [],
        messageID: 'msg-incoming',
        messageType: 'message',
        data: { type: 'incoming-test' },
        timestamp: Date.now(),
      }
      const message = {
        status: 'incoming' as const,
        message: internalMessage,
      }

      PortMessage.toExtensionContext(mockPort, message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
    })

    it('should post a terminated status message', () => {
      const fingerprint: EndpointFingerprint = 'uid::terminated-fp-789'
      const message = {
        status: 'terminated' as const,
        fingerprint,
      }

      PortMessage.toExtensionContext(mockPort, message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
    })
  })
})
