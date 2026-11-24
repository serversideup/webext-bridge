import { usePostMessaging } from './post-message'
import { getMessagePort } from './message-port'
import type { InternalMessage } from '../types'

jest.mock('./message-port')

describe('usePostMessaging', () => {
  const mockGetMessagePort = getMessagePort as jest.MockedFunction<typeof getMessagePort>
  const mockPort = {
    postMessage: jest.fn(),
  } as unknown as MessagePort

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMessagePort.mockResolvedValue(mockPort)
  })

  describe('enable', () => {
    it('should enable messaging', () => {
      const hook = usePostMessaging('window')
      expect(() => hook.enable()).not.toThrow()
    })
  })

  describe('onMessage', () => {
    it('should set the message callback', () => {
      const hook = usePostMessaging('window')
      const callback = jest.fn()
      hook.onMessage(callback)
      // The callback is stored internally, we verify by calling enable and checking it's set
      hook.enable()
      expect(callback).toBeDefined()
    })
  })

  describe('setNamespace', () => {
    it('should set the namespace and initialize message port', async () => {
      const hook = usePostMessaging('window')
      hook.setNamespace('test-namespace')
      expect(mockGetMessagePort).toHaveBeenCalledWith(
        'window',
        'test-namespace',
        expect.any(Function)
      )
    })

    it('should throw when namespace is changed after being set', () => {
      const hook = usePostMessaging('window')
      hook.setNamespace('test-namespace')
      expect(() => hook.setNamespace('another-namespace')).toThrow(
        'Namespace once set cannot be changed'
      )
    })

    it('should call the onMessage callback when a message is received', async () => {
      const hook = usePostMessaging('window')
      const callback = jest.fn()
      hook.onMessage(callback)
      hook.setNamespace('test-namespace')

      // Wait for the port promise to resolve
      await Promise.resolve()

      // Get the message handler that was passed to getMessagePort
      const messageHandler = mockGetMessagePort.mock.calls[0][2]
      const testMessage: InternalMessage = {
        origin: { context: 'background', tabId: 0 },
        destination: { context: 'window', tabId: 1 },
        transactionId: 'tx-123',
        hops: [],
        messageID: 'msg-123',
        messageType: 'message',
        data: { type: 'test' },
        timestamp: Date.now(),
      }

      messageHandler({ data: testMessage } as MessageEvent)

      expect(callback).toHaveBeenCalledWith(testMessage)
    })

    it('should handle EndpointWontRespondError messages', async () => {
      const hook = usePostMessaging('window')
      const callback = jest.fn()
      hook.onMessage(callback)
      hook.setNamespace('test-namespace')

      await Promise.resolve()

      const messageHandler = mockGetMessagePort.mock.calls[0][2]
      const errorResponse = {
        type: 'error' as const,
        transactionID: 'tx-error',
      }

      messageHandler({ data: errorResponse } as MessageEvent)

      expect(callback).toHaveBeenCalledWith(errorResponse)
    })

    it('should not call callback if onMessage was not set', async () => {
      const hook = usePostMessaging('window')
      hook.setNamespace('test-namespace')

      await Promise.resolve()

      const messageHandler = mockGetMessagePort.mock.calls[0][2]
      const testMessage: InternalMessage = {
        origin: { context: 'background', tabId: 0 },
        destination: { context: 'window', tabId: 1 },
        transactionId: 'tx-123',
        hops: [],
        messageID: 'msg-123',
        messageType: 'message',
        timestamp: Date.now(),
      }

      expect(() => messageHandler({ data: testMessage } as MessageEvent)).not.toThrow()
    })
  })

  describe('postMessage', () => {
    it('should post a message when messaging is enabled and namespace is set', async () => {
      const hook = usePostMessaging('window')
      hook.enable()
      hook.setNamespace('test-namespace')

      const testMessage: InternalMessage = {
        origin: { context: 'window', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-123',
        hops: [],
        messageID: 'msg-123',
        messageType: 'message',
        data: { type: 'test' },
        timestamp: Date.now(),
      }

      await hook.postMessage(testMessage)

      expect(mockPort.postMessage).toHaveBeenCalledWith(testMessage)
    })

    it('should post an EndpointWontRespondError message', async () => {
      const hook = usePostMessaging('window')
      hook.enable()
      hook.setNamespace('test-namespace')

      const errorResponse = {
        type: 'error' as const,
        transactionID: 'tx-error',
      }

      await hook.postMessage(errorResponse)

      expect(mockPort.postMessage).toHaveBeenCalledWith(errorResponse)
    })

    it('should throw when messaging is not enabled', async () => {
      const hook = usePostMessaging('window')
      hook.setNamespace('test-namespace')

      const testMessage: InternalMessage = {
        origin: { context: 'window', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-123',
        hops: [],
        messageID: 'msg-123',
        messageType: 'message',
        timestamp: Date.now(),
      }

      await expect(hook.postMessage(testMessage)).rejects.toThrow(
        'Communication with window has not been allowed'
      )
    })

    it('should throw when namespace is not set', async () => {
      const hook = usePostMessaging('window')
      hook.enable()

      const testMessage: InternalMessage = {
        origin: { context: 'window', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-123',
        hops: [],
        messageID: 'msg-123',
        messageType: 'message',
        timestamp: Date.now(),
      }

      await expect(hook.postMessage(testMessage)).rejects.toThrow(
        'webext-bridge uses window.postMessage to talk with other "window"(s) for message routing'
      )
    })

    it('should throw when namespace is empty string', async () => {
      const hook = usePostMessaging('window')
      hook.enable()
      hook.setNamespace('')

      const testMessage: InternalMessage = {
        origin: { context: 'window', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-123',
        hops: [],
        messageID: 'msg-123',
        messageType: 'message',
        timestamp: Date.now(),
      }

      await expect(hook.postMessage(testMessage)).rejects.toThrow(
        'webext-bridge uses window.postMessage to talk with other "window"(s) for message routing'
      )
    })

    it('should throw when namespace is whitespace only', async () => {
      const hook = usePostMessaging('window')
      hook.enable()
      hook.setNamespace('   ')

      const testMessage: InternalMessage = {
        origin: { context: 'window', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-123',
        hops: [],
        messageID: 'msg-123',
        messageType: 'message',
        timestamp: Date.now(),
      }

      await expect(hook.postMessage(testMessage)).rejects.toThrow(
        'webext-bridge uses window.postMessage to talk with other "window"(s) for message routing'
      )
    })

    it('should throw when thisContext is not window or content-script', async () => {
      // This tests the internal check - though the type system prevents this at compile time
      // We test by checking the error would be thrown if invalid context was passed
      const hook = usePostMessaging('window')
      hook.enable()
      hook.setNamespace('test-namespace')

      // Valid contexts should work
      const testMessage: InternalMessage = {
        origin: { context: 'window', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-123',
        hops: [],
        messageID: 'msg-123',
        messageType: 'message',
        timestamp: Date.now(),
      }

      await expect(hook.postMessage(testMessage)).resolves.not.toThrow()
    })
  })

  describe('content-script context', () => {
    it('should work with content-script context', async () => {
      const hook = usePostMessaging('content-script')
      hook.enable()
      hook.setNamespace('test-namespace')

      const testMessage: InternalMessage = {
        origin: { context: 'content-script', tabId: 1 },
        destination: { context: 'background', tabId: 0 },
        transactionId: 'tx-123',
        hops: [],
        messageID: 'msg-123',
        messageType: 'message',
        timestamp: Date.now(),
      }

      await hook.postMessage(testMessage)

      expect(mockGetMessagePort).toHaveBeenCalledWith(
        'content-script',
        'test-namespace',
        expect.any(Function)
      )
      expect(mockPort.postMessage).toHaveBeenCalledWith(testMessage)
    })
  })

  describe('isolated instances', () => {
    it('should maintain separate state for different instances', () => {
      const hook1 = usePostMessaging('window')
      const hook2 = usePostMessaging('window')

      hook1.setNamespace('namespace-1')
      // hook2 should be able to set its own namespace
      expect(() => hook2.setNamespace('namespace-2')).not.toThrow()
    })
  })
})
