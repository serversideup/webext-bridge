import { createEndpointRuntime } from './endpoint-runtime'
import type { InternalMessage, RuntimeContext } from '../types'

// Mock tiny-uid
let uuidCounter = 0
jest.mock('tiny-uid', () => () => {
  uuidCounter++
  return `mock-uuid-${uuidCounter}`
})

// Mock serialize-error
jest.mock('serialize-error', () => ({
  __esModule: true,
  serializeError: (err: Error) => err ? ({
    name: err.name,
    message: err.message,
    stack: err.stack,
  }) : undefined,
}))

// Mock self for browser globals
Object.defineProperty(global, 'self', {
  value: {
    Error,
    TypeError,
    RangeError,
    ReferenceError,
    SyntaxError,
    URIError,
  },
  writable: true,
  configurable: true,
})

describe('createEndpointRuntime', () => {
  let mockRouteMessage: jest.Mock
  let mockLocalMessage: jest.Mock
  let runtime: ReturnType<typeof createEndpointRuntime>
  const thisContext: RuntimeContext = 'content-script'

  beforeEach(() => {
    uuidCounter = 0
    mockRouteMessage = jest.fn()
    mockLocalMessage = jest.fn()
    runtime = createEndpointRuntime(thisContext, mockRouteMessage, mockLocalMessage)
  })

  afterEach(async () => {
    jest.clearAllMocks()
    // Wait for any pending async operations
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  describe('sendMessage', () => {
    it('should send a message with string destination', async () => {
      const messageID = 'test-message'
      const data = { foo: 'bar' }

      const promise = runtime.sendMessage(messageID, data, 'background')

      expect(mockRouteMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageID,
          data,
          messageType: 'message',
          origin: { context: thisContext, tabId: null },
          hops: expect.arrayContaining([expect.stringMatching(/content-script::mock-uuid-/)]),
        }),
      )

      // Simulate reply
      const callArg = mockRouteMessage.mock.calls[0][0] as InternalMessage
      runtime.handleMessage({
        ...callArg,
        messageType: 'reply',
        data: { result: 'success' },
        destination: { context: thisContext, tabId: null, frameId: null },
        origin: { context: 'background', tabId: null },
        hops: [],
      })

      const result = await promise
      expect(result).toEqual({ result: 'success' })
    })

    it('should send a message with object destination', async () => {
      const messageID = 'test-message'
      const data = { foo: 'bar' }
      const destination = { context: 'content-script' as RuntimeContext, tabId: 123 }

      const promise = runtime.sendMessage(messageID, data, destination)

      expect(mockRouteMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageID,
          data,
          destination,
        }),
      )

      // Simulate reply
      const callArg = mockRouteMessage.mock.calls[0][0] as InternalMessage
      runtime.handleMessage({
        ...callArg,
        messageType: 'reply',
        data: { result: 'success' },
        destination: { context: thisContext, tabId: null, frameId: null },
        origin: destination,
        hops: [],
      })

      const result = await promise
      expect(result).toEqual({ result: 'success' })
    })

    it('should throw error for unknown destination context', () => {
      const messageID = 'test-message'
      const data = { foo: 'bar' }
      // When passing an object with undefined context, it should throw
      const destination = { context: undefined as unknown as RuntimeContext, tabId: null, frameId: undefined }

      expect(() => runtime.sendMessage(messageID, data, destination)).toThrow(
        'Bridge#sendMessage -> Destination must be any one of known destinations',
      )
    })

    it('should reject promise when handleMessage throws', async () => {
      const messageID = 'test-message'
      const data = { foo: 'bar' }

      mockRouteMessage.mockImplementation(() => {
        throw new Error('Route error')
      })

      await expect(runtime.sendMessage(messageID, data, 'background')).rejects.toThrow(
        'Route error',
      )
    })

    it('should use default destination "background"', async () => {
      const messageID = 'test-message'
      const data = { foo: 'bar' }

      runtime.sendMessage(messageID, data)

      expect(mockRouteMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: expect.objectContaining({ context: 'background' }),
        }),
      )
    })
  })

  describe('onMessage', () => {
    it('should register a message handler', async () => {
      const messageID = 'test-message'
      const callback = jest.fn().mockResolvedValue({ response: 'ok' })

      runtime.onMessage(messageID, callback)

      const message: InternalMessage = {
        messageID,
        data: { input: 'test' },
        messageType: 'message',
        transactionId: 'tx-123',
        origin: { context: 'background', tabId: null },
        destination: { context: thisContext, tabId: null, frameId: null },
        hops: [],
        timestamp: Date.now(),
      }

      runtime.handleMessage(message)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: { context: 'background', tabId: null },
          id: messageID,
          data: { input: 'test' },
        }),
      )
    })

    it('should return an unsubscribe function', () => {
      const messageID = 'test-message'
      const callback = jest.fn()

      const unsubscribe = runtime.onMessage(messageID, callback)

      expect(typeof unsubscribe).toBe('function')

      unsubscribe()

      // After unsubscribing, handler should not be called
      const message: InternalMessage = {
        messageID,
        data: { input: 'test' },
        messageType: 'message',
        transactionId: 'tx-123',
        origin: { context: 'background', tabId: null },
        destination: { context: thisContext, tabId: null, frameId: null },
        hops: [],
        timestamp: Date.now(),
      }

      runtime.handleMessage(message)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should throw error when no handler is registered', async () => {
      const messageID = 'non-existent-message'

      const message: InternalMessage = {
        messageID,
        data: { input: 'test' },
        messageType: 'message',
        transactionId: 'tx-123',
        origin: { context: 'background', tabId: null },
        destination: { context: thisContext, tabId: null, frameId: null },
        hops: [],
        timestamp: Date.now(),
      }

      runtime.handleMessage(message)

      // The reply message should contain an error
      expect(mockRouteMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'reply',
          err: expect.objectContaining({
            message: expect.stringContaining('No handler registered'),
          }),
        }),
      )
    })

    it('should handle async callback', async () => {
      const messageID = 'async-message'
      const callback = jest.fn().mockResolvedValue({ async: 'result' })

      runtime.onMessage(messageID, callback)

      const message: InternalMessage = {
        messageID,
        data: { input: 'test' },
        messageType: 'message',
        transactionId: 'tx-123',
        origin: { context: 'background', tabId: null },
        destination: { context: thisContext, tabId: null, frameId: null },
        hops: [],
        timestamp: Date.now(),
      }

      runtime.handleMessage(message)

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockRouteMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'reply',
          data: { async: 'result' },
        }),
      )
    })

    it('should handle callback error', async () => {
      const messageID = 'error-message'
      const testError = new Error('Callback error')
      const callback = jest.fn().mockRejectedValue(testError)

      runtime.onMessage(messageID, callback)

      const message: InternalMessage = {
        messageID,
        data: { input: 'test' },
        messageType: 'message',
        transactionId: 'tx-123',
        origin: { context: 'background', tabId: null },
        destination: { context: thisContext, tabId: null, frameId: null },
        hops: [],
        timestamp: Date.now(),
      }

      // The callback error will be caught and sent as reply, then re-thrown
      await expect(runtime.handleMessage(message)).rejects.toBeUndefined()

      expect(mockRouteMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'reply',
          err: expect.objectContaining({
            message: 'Callback error',
          }),
        }),
      )
    })
  })

  describe('handleMessage', () => {
    describe('reply handling', () => {
      it('should resolve promise on successful reply', async () => {
        const messageID = 'test-message'
        const data = { foo: 'bar' }

        const promise = runtime.sendMessage(messageID, data, 'background')

        const callArg = mockRouteMessage.mock.calls[0][0] as InternalMessage

        runtime.handleMessage({
          ...callArg,
          messageType: 'reply',
          data: { success: true },
          destination: { context: thisContext, tabId: null, frameId: null },
          origin: { context: 'background', tabId: null },
          hops: [],
        })

        const result = await promise
        expect(result).toEqual({ success: true })
      })

      it('should reject promise on error reply', async () => {
        const messageID = 'test-message'
        const data = { foo: 'bar' }

        const promise = runtime.sendMessage(messageID, data, 'background')

        const callArg = mockRouteMessage.mock.calls[0][0] as InternalMessage

        runtime.handleMessage({
          ...callArg,
          messageType: 'reply',
          err: { name: 'TypeError', message: 'Custom error', stack: '' },
          destination: { context: thisContext, tabId: null, frameId: null },
          origin: { context: 'background', tabId: null },
          hops: [],
        })

        await expect(promise).rejects.toThrow('Custom error')
      })

      it('should hydrate custom error types', async () => {
        const messageID = 'test-message'
        const data = { foo: 'bar' }

        const promise = runtime.sendMessage(messageID, data, 'background')

        const callArg = mockRouteMessage.mock.calls[0][0] as InternalMessage

        runtime.handleMessage({
          ...callArg,
          messageType: 'reply',
          err: { name: 'RangeError', message: 'Range error', stack: '' },
          destination: { context: thisContext, tabId: null, frameId: null },
          origin: { context: 'background', tabId: null },
          hops: [],
        })

        await expect(promise).rejects.toThrow(RangeError)
      })

      it('should fallback to Error for unknown error types', async () => {
        const messageID = 'test-message'
        const data = { foo: 'bar' }

        const promise = runtime.sendMessage(messageID, data, 'background')

        const callArg = mockRouteMessage.mock.calls[0][0] as InternalMessage

        runtime.handleMessage({
          ...callArg,
          messageType: 'reply',
          err: { name: 'UnknownError', message: 'Unknown error', stack: '' },
          destination: { context: thisContext, tabId: null, frameId: null },
          origin: { context: 'background', tabId: null },
          hops: [],
        })

        await expect(promise).rejects.toThrow(Error)
      })
    })

    describe('message routing', () => {
      it('should route messages not meant for this context', () => {
        const message: InternalMessage = {
          messageID: 'test-message',
          data: { input: 'test' },
          messageType: 'message',
          transactionId: 'tx-123',
          origin: { context: 'background', tabId: null },
          destination: { context: 'popup', tabId: null },
          hops: [],
          timestamp: Date.now(),
        }

        runtime.handleMessage(message)

        expect(mockRouteMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            hops: expect.arrayContaining([
              expect.stringMatching(/content-script::/),
            ]),
          }),
        )
      })

      it('should route messages with frameId in destination', () => {
        const message: InternalMessage = {
          messageID: 'test-message',
          data: { input: 'test' },
          messageType: 'message',
          transactionId: 'tx-123',
          origin: { context: 'background', tabId: null },
          destination: { context: thisContext, frameId: 1, tabId: null },
          hops: [],
          timestamp: Date.now(),
        }

        runtime.handleMessage(message)

        expect(mockRouteMessage).toHaveBeenCalled()
      })

      it('should route messages with tabId in destination', () => {
        const message: InternalMessage = {
          messageID: 'test-message',
          data: { input: 'test' },
          messageType: 'message',
          transactionId: 'tx-123',
          origin: { context: 'background', tabId: null },
          destination: { context: thisContext, tabId: 123, frameId: null },
          hops: [],
          timestamp: Date.now(),
        }

        runtime.handleMessage(message)

        expect(mockRouteMessage).toHaveBeenCalled()
      })

      it('should add runtimeId to hops when routing', () => {
        const message: InternalMessage = {
          messageID: 'test-message',
          data: { input: 'test' },
          messageType: 'message',
          transactionId: 'tx-123',
          origin: { context: 'background', tabId: null },
          destination: { context: 'popup', tabId: null },
          hops: [],
          timestamp: Date.now(),
        }

        runtime.handleMessage(message)

        expect(mockRouteMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            hops: expect.arrayContaining([
              expect.stringMatching(/content-script::[\w-]+/),
            ]),
          }),
        )
      })
    })

    describe('local message handling', () => {
      it('should call localMessage callback for local messages', () => {
        const message: InternalMessage = {
          messageID: 'test-message',
          data: { input: 'test' },
          messageType: 'message',
          transactionId: 'tx-123',
          origin: { context: 'background', tabId: null },
          destination: { context: thisContext, tabId: null, frameId: null },
          hops: [],
          timestamp: Date.now(),
        }

        runtime.handleMessage(message)

        expect(mockLocalMessage).toHaveBeenCalledWith(message)
      })
    })
  })

  describe('endTransaction', () => {
    it('should reject pending transaction', async () => {
      const messageID = 'test-message'
      const data = { foo: 'bar' }

      const promise = runtime.sendMessage(messageID, data, 'background')

      const callArg = mockRouteMessage.mock.calls[0][0] as InternalMessage
      const transactionId = callArg.transactionId

      runtime.endTransaction(transactionId)

      await expect(promise).rejects.toMatch(
        'Transaction was ended before it could complete',
      )
    })

    it('should remove transaction from open transactions', async () => {
      const messageID = 'test-message'
      const data = { foo: 'bar' }

      const promise = runtime.sendMessage(messageID, data, 'background')

      const callArg = mockRouteMessage.mock.calls[0][0] as InternalMessage
      const transactionId = callArg.transactionId

      runtime.endTransaction(transactionId)

      // After ending, the transaction should be removed
      // This is tested indirectly by the promise rejection
      await expect(promise).rejects.toMatch(
        'Transaction was ended before it could complete',
      )
    })

    it('should not throw when ending non-existent transaction', () => {
      expect(() => runtime.endTransaction('non-existent-tx')).not.toThrow()
    })
  })

  describe('message flow', () => {
    it('should complete full request-reply cycle', async () => {
      const messageID = 'full-cycle'
      const requestData = { request: 'data' }
      const responseData = { response: 'data' }

      // Register handler in this context
      runtime.onMessage(messageID, async (msg) => {
        expect(msg.data).toEqual(requestData)
        return responseData
      })

      // Send message from this context to background
      const promise = runtime.sendMessage(messageID, requestData, 'background')

      // Get the routed message (going to background)
      const routedMessage = mockRouteMessage.mock.calls[0][0] as InternalMessage

      // Simulate the reply coming back from background
      // This is what background would send back after handling the message
      const replyMessage: InternalMessage = {
        messageID,
        messageType: 'reply',
        transactionId: routedMessage.transactionId,
        data: responseData,
        origin: { context: 'background', tabId: null },
        destination: { context: thisContext, tabId: null, frameId: null },
        hops: [],
        timestamp: Date.now(),
      }

      // Handle the reply - this should resolve the original promise
      runtime.handleMessage(replyMessage)

      const result = await promise
      expect(result).toEqual(responseData)
    })
  })
})
