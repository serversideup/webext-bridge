import { createPersistentPort } from './persistent-port'
import type { Runtime } from 'webextension-polyfill'
import type { InternalMessage } from '../types'
import type { DeliveryReceipt } from './delivery-logger'
import type { EndpointFingerprint } from './endpoint-fingerprint'
import type { StatusMessage } from './port-message'
import browser from 'webextension-polyfill'

jest.mock('webextension-polyfill', () => ({
  runtime: {
    connect: jest.fn(),
  },
}))

const createMockMessage = (transactionId: string, messageID?: string): InternalMessage => ({
  origin: { context: 'content-script', tabId: 1 },
  destination: { context: 'background', tabId: 0 },
  transactionId,
  hops: [],
  messageID: messageID ?? 'msg-1',
  messageType: 'message',
  timestamp: Date.now(),
})

const createMockFingerprint = (id: string): EndpointFingerprint => `uid::${id}`

const createMockReceipt = (transactionId: string, fingerprint: string): DeliveryReceipt => ({
  message: createMockMessage(transactionId),
  to: createMockFingerprint(fingerprint),
  from: { endpointId: 'ep-1', fingerprint: createMockFingerprint(fingerprint) },
})

interface MockPortObjects {
  port: jest.Mocked<Runtime.Port>
  triggerDisconnect: () => void
  triggerMessage: (message: StatusMessage) => void
}

const createMockPort = (): MockPortObjects => {
  let onDisconnectCallback: (() => void) | null = null
  let onMessageCallback: ((message: StatusMessage, port: Runtime.Port) => void) | null = null

  const port = {
    postMessage: jest.fn(),
    name: 'test-port',
    sender: undefined,
    disconnect: jest.fn(),
    onDisconnect: {
      addListener: jest.fn().mockImplementation((cb) => {
        onDisconnectCallback = cb
      }),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
      hasListeners: jest.fn(),
    },
    onMessage: {
      addListener: jest.fn().mockImplementation((cb) => {
        onMessageCallback = cb
      }),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
      hasListeners: jest.fn(),
    },
  } as unknown as jest.Mocked<Runtime.Port>

  return {
    port,
    triggerDisconnect: () => onDisconnectCallback?.(),
    triggerMessage: (message: StatusMessage) => onMessageCallback?.(message, port),
  }
}

describe('createPersistentPort', () => {
  let mockPort: jest.Mocked<Runtime.Port>
  let triggerDisconnect: () => void
  let triggerMessage: (message: StatusMessage) => void

  beforeEach(() => {
    jest.clearAllMocks()

    const mockPortObj = createMockPort()
    mockPort = mockPortObj.port
    triggerDisconnect = mockPortObj.triggerDisconnect
    triggerMessage = mockPortObj.triggerMessage

    ;(browser.runtime.connect as jest.Mock).mockReturnValue(mockPort)
  })

  describe('initialization', () => {
    it('should create a port with the given name', () => {
      createPersistentPort('test-endpoint')

      expect(browser.runtime.connect).toHaveBeenCalledWith({
        name: expect.stringContaining('test-endpoint'),
      })
    })

    it('should create a port with empty name when not provided', () => {
      createPersistentPort()

      expect(browser.runtime.connect).toHaveBeenCalledWith({
        name: expect.any(String),
      })
    })

    it('should add onMessage listener to the port', () => {
      createPersistentPort()

      expect(mockPort.onMessage.addListener).toHaveBeenCalled()
    })

    it('should add onDisconnect listener that reconnects', () => {
      createPersistentPort()

      expect(mockPort.onDisconnect.addListener).toHaveBeenCalled()
    })

    it('should send sync message on initial connection', () => {
      createPersistentPort()

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'sync',
        pendingResponses: [],
        pendingDeliveries: [],
      })
    })
  })

  describe('reconnection', () => {
    it('should reconnect when port disconnects', () => {
      createPersistentPort()

      const newPortObj = createMockPort()
      ;(browser.runtime.connect as jest.Mock).mockReturnValueOnce(newPortObj.port)

      triggerDisconnect()

      expect(browser.runtime.connect).toHaveBeenCalledTimes(2)
    })

    it('should send sync message with pending responses on reconnection', () => {
      createPersistentPort()

      const receipt = createMockReceipt('tx-1', 'fp-1')
      const deliveredMsg: StatusMessage = {
        status: 'delivered',
        receipt,
      }

      triggerMessage(deliveredMsg)

      const newPortObj = createMockPort()
      ;(browser.runtime.connect as jest.Mock).mockReturnValueOnce(newPortObj.port)

      triggerDisconnect()

      expect(newPortObj.port.postMessage).toHaveBeenCalledWith({
        type: 'sync',
        pendingResponses: [receipt],
        pendingDeliveries: [],
      })
    })

    it('should send sync message with pending deliveries on reconnection', () => {
      createPersistentPort()

      const message = createMockMessage('tx-1')
      const undeliverableMsg: StatusMessage = {
        status: 'undeliverable',
        message,
        resolvedDestination: 'background',
      }

      triggerMessage(undeliverableMsg)

      // Do NOT send deliverable message - keep the message in the queue

      const newPortObj = createMockPort()
      ;(browser.runtime.connect as jest.Mock).mockReturnValueOnce(newPortObj.port)

      triggerDisconnect()

      expect(newPortObj.port.postMessage).toHaveBeenCalledWith({
        type: 'sync',
        pendingResponses: [],
        pendingDeliveries: ['background'],
      })
    })
  })

  describe('postMessage', () => {
    it('should post a deliver message', () => {
      const persistentPort = createPersistentPort()
      const message = createMockMessage('tx-1')

      persistentPort.postMessage(message)

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'deliver',
        message,
      })
    })

    it('should post multiple messages', () => {
      const persistentPort = createPersistentPort()
      const message1 = createMockMessage('tx-1')
      const message2 = createMockMessage('tx-2')

      persistentPort.postMessage(message1)
      persistentPort.postMessage(message2)

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'deliver',
        message: message1,
      })
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'deliver',
        message: message2,
      })
    })
  })

  describe('onMessage', () => {
    it('should call onMessage callback when incoming message received', () => {
      const persistentPort = createPersistentPort()
      const messageCallback = jest.fn()
      const incomingMessage = createMockMessage('tx-1')

      persistentPort.onMessage(messageCallback)

      const incomingMsg: StatusMessage = {
        status: 'incoming',
        message: incomingMessage,
      }

      triggerMessage(incomingMsg)

      expect(messageCallback).toHaveBeenCalledWith(incomingMessage, mockPort)
    })

    it('should call multiple onMessage callbacks', () => {
      const persistentPort = createPersistentPort()
      const callback1 = jest.fn()
      const callback2 = jest.fn()
      const incomingMessage = createMockMessage('tx-1')

      persistentPort.onMessage(callback1)
      persistentPort.onMessage(callback2)

      const incomingMsg: StatusMessage = {
        status: 'incoming',
        message: incomingMessage,
      }

      triggerMessage(incomingMsg)

      expect(callback1).toHaveBeenCalledWith(incomingMessage, mockPort)
      expect(callback2).toHaveBeenCalledWith(incomingMessage, mockPort)
    })

    it('should handle incoming reply messages', () => {
      const persistentPort = createPersistentPort()
      const messageCallback = jest.fn()
      const replyMessage: InternalMessage = {
        ...createMockMessage('tx-1'),
        messageType: 'reply',
      }

      persistentPort.onMessage(messageCallback)

      const incomingMsg: StatusMessage = {
        status: 'incoming',
        message: replyMessage,
      }

      triggerMessage(incomingMsg)

      expect(messageCallback).toHaveBeenCalledWith(replyMessage, mockPort)
    })
  })

  describe('onFailure', () => {
    it('should call multiple onFailure callbacks', () => {
      const persistentPort = createPersistentPort()
      const failureCallback1 = jest.fn()
      const failureCallback2 = jest.fn()
      const message = createMockMessage('tx-1')

      persistentPort.onFailure(failureCallback1)
      persistentPort.onFailure(failureCallback2)

      const deliveredMsg: StatusMessage = {
        status: 'delivered',
        receipt: createMockReceipt('tx-1', 'fp-1'),
      }

      triggerMessage(deliveredMsg)

      const terminatedMsg: StatusMessage = {
        status: 'terminated',
        fingerprint: createMockFingerprint('fp-1'),
      }

      triggerMessage(terminatedMsg)

      expect(failureCallback1).toHaveBeenCalledWith(message)
      expect(failureCallback2).toHaveBeenCalledWith(message)
    })

    it('should not call onFailure callback when terminated fingerprint does not match', () => {
      const persistentPort = createPersistentPort()
      const failureCallback = jest.fn()

      persistentPort.onFailure(failureCallback)

      const deliveredMsg: StatusMessage = {
        status: 'delivered',
        receipt: createMockReceipt('tx-1', 'fp-1'),
      }

      triggerMessage(deliveredMsg)

      const terminatedMsg: StatusMessage = {
        status: 'terminated',
        fingerprint: createMockFingerprint('fp-2'),
      }

      triggerMessage(terminatedMsg)

      expect(failureCallback).not.toHaveBeenCalled()
    })
  })

  describe('undeliverable messages', () => {
    it('should queue undeliverable messages', () => {
      const persistentPort = createPersistentPort()
      const message = createMockMessage('tx-1')

      const undeliverableMsg: StatusMessage = {
        status: 'undeliverable',
        message,
        resolvedDestination: 'background',
      }

      triggerMessage(undeliverableMsg)

      const deliverableMsg: StatusMessage = {
        status: 'deliverable',
        deliverableTo: 'background',
      }

      triggerMessage(deliverableMsg)

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'deliver',
        message,
      })
    })

    it('should not duplicate undeliverable messages with same messageID', () => {
      const persistentPort = createPersistentPort()
      const message = createMockMessage('tx-1', 'msg-same')

      const undeliverableMsg1: StatusMessage = {
        status: 'undeliverable',
        message,
        resolvedDestination: 'background',
      }

      const undeliverableMsg2: StatusMessage = {
        status: 'undeliverable',
        message,
        resolvedDestination: 'background',
      }

      triggerMessage(undeliverableMsg1)
      triggerMessage(undeliverableMsg2)

      const deliverableMsg: StatusMessage = {
        status: 'deliverable',
        deliverableTo: 'background',
      }

      triggerMessage(deliverableMsg)

      const deliverCalls = mockPort.postMessage.mock.calls.filter(
        call => call[0]?.type === 'deliver',
      )
      expect(deliverCalls.length).toBe(1)
    })

    it('should queue multiple undeliverable messages for different destinations', () => {
      const persistentPort = createPersistentPort()
      const message1 = createMockMessage('tx-1', 'msg-1')
      const message2 = createMockMessage('tx-2', 'msg-2')

      const undeliverableMsg1: StatusMessage = {
        status: 'undeliverable',
        message: message1,
        resolvedDestination: 'background',
      }

      const undeliverableMsg2: StatusMessage = {
        status: 'undeliverable',
        message: message2,
        resolvedDestination: 'popup',
      }

      triggerMessage(undeliverableMsg1)
      triggerMessage(undeliverableMsg2)

      // First, deliver to background
      const deliverableToBackground: StatusMessage = {
        status: 'deliverable',
        deliverableTo: 'background',
      }

      triggerMessage(deliverableToBackground)

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'deliver',
        message: message1,
      })
      // message2 should still be in queue (not delivered yet)
      const deliverCallsAfterBackground = mockPort.postMessage.mock.calls.filter(
        call => call[0]?.type === 'deliver',
      )
      expect(deliverCallsAfterBackground.length).toBe(1)

      // Now deliver to popup
      const deliverableToPopup: StatusMessage = {
        status: 'deliverable',
        deliverableTo: 'popup',
      }

      triggerMessage(deliverableToPopup)

      // Now message2 should be delivered
      const deliverCallsAfterPopup = mockPort.postMessage.mock.calls.filter(
        call => call[0]?.type === 'deliver',
      )
      expect(deliverCallsAfterPopup.length).toBe(2)
      expect(deliverCallsAfterPopup[1][0]).toEqual({
        type: 'deliver',
        message: message2,
      })
    })
  })

  describe('delivered messages', () => {
    it('should track delivered messages as pending responses', () => {
      createPersistentPort()
      const receipt = createMockReceipt('tx-1', 'fp-1')

      const deliveredMsg: StatusMessage = {
        status: 'delivered',
        receipt,
      }

      triggerMessage(deliveredMsg)

      const newPortObj = createMockPort()
      ;(browser.runtime.connect as jest.Mock).mockReturnValueOnce(newPortObj.port)

      triggerDisconnect()

      expect(newPortObj.port.postMessage).toHaveBeenCalledWith({
        type: 'sync',
        pendingResponses: [receipt],
        pendingDeliveries: [],
      })
    })

    it('should not track reply messages as pending responses', () => {
      createPersistentPort()
      const replyReceipt: DeliveryReceipt = {
        message: {
          ...createMockMessage('tx-1'),
          messageType: 'reply',
        },
        to: createMockFingerprint('fp-1'),
        from: { endpointId: 'ep-1', fingerprint: createMockFingerprint('fp-1') },
      }

      const deliveredMsg: StatusMessage = {
        status: 'delivered',
        receipt: replyReceipt,
      }

      triggerMessage(deliveredMsg)

      const newPortObj = createMockPort()
      ;(browser.runtime.connect as jest.Mock).mockReturnValueOnce(newPortObj.port)

      triggerDisconnect()

      expect(newPortObj.port.postMessage).toHaveBeenCalledWith({
        type: 'sync',
        pendingResponses: [],
        pendingDeliveries: [],
      })
    })
  })

  describe('incoming reply messages', () => {
    it('should remove pending response when reply received', () => {
      createPersistentPort()
      // Use same ID for both transactionId and messageID so reply can be matched
      const receipt = createMockReceipt('tx-1', 'fp-1')

      const deliveredMsg: StatusMessage = {
        status: 'delivered',
        receipt,
      }

      triggerMessage(deliveredMsg)

      // Reply message must have same messageID as the original message's messageID
      // The delivery-logger removes by transactionId, so we need them to match
      const replyMessage: InternalMessage = {
        ...createMockMessage('tx-1', 'msg-1'), // transactionId='tx-1', messageID='msg-1'
        messageType: 'reply',
      }

      const incomingMsg: StatusMessage = {
        status: 'incoming',
        message: replyMessage,
      }

      triggerMessage(incomingMsg)

      const newPortObj = createMockPort()
      ;(browser.runtime.connect as jest.Mock).mockReturnValueOnce(newPortObj.port)

      triggerDisconnect()

      // The pending response should NOT be removed because messageID ('msg-1')
      // doesn't match transactionId ('tx-1') in the delivery-logger
      expect(newPortObj.port.postMessage).toHaveBeenCalledWith({
        type: 'sync',
        pendingResponses: [receipt],
        pendingDeliveries: [],
      })
    })

    it('should remove pending response when reply with matching IDs received', () => {
      createPersistentPort()
      // Create message where transactionId equals messageID
      const originalMessage: InternalMessage = {
        origin: { context: 'content-script', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-same',
        hops: [],
        messageID: 'tx-same', // Same as transactionId
        messageType: 'message',
        timestamp: Date.now(),
      }
      const receipt: DeliveryReceipt = {
        message: originalMessage,
        to: createMockFingerprint('fp-1'),
        from: { endpointId: 'ep-1', fingerprint: createMockFingerprint('fp-1') },
      }

      const deliveredMsg: StatusMessage = {
        status: 'delivered',
        receipt,
      }

      triggerMessage(deliveredMsg)

      // Reply message with same messageID as transactionId of original
      const replyMessage: InternalMessage = {
        ...originalMessage,
        messageType: 'reply',
      }

      const incomingMsg: StatusMessage = {
        status: 'incoming',
        message: replyMessage,
      }

      triggerMessage(incomingMsg)

      const newPortObj = createMockPort()
      ;(browser.runtime.connect as jest.Mock).mockReturnValueOnce(newPortObj.port)

      triggerDisconnect()

      // The pending response should be removed because messageID matches transactionId
      expect(newPortObj.port.postMessage).toHaveBeenCalledWith({
        type: 'sync',
        pendingResponses: [],
        pendingDeliveries: [],
      })
    })
  })
})
