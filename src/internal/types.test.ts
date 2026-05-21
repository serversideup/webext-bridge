import type { QueuedMessage } from './types'
import type { InternalMessage } from '../types'

describe('QueuedMessage', () => {
  it('should have correct structure with resolvedDestination and message', () => {
    const mockMessage: InternalMessage = {
      origin: { context: 'background', tabId: 1 },
      destination: { context: 'content-script', tabId: 1 },
      transactionId: 'tx-123',
      hops: ['background'],
      messageID: 'msg-456',
      messageType: 'message',
      data: { key: 'value' },
      timestamp: Date.now(),
    }

    const queuedMessage: QueuedMessage = {
      resolvedDestination: 'content-script',
      message: mockMessage,
    }

    expect(queuedMessage.resolvedDestination).toBe('content-script')
    expect(queuedMessage.message).toEqual(mockMessage)
  })

  it('should accept different resolvedDestination values', () => {
    const mockMessage: InternalMessage = {
      origin: { context: 'devtools', tabId: 2 },
      destination: { context: 'popup', tabId: 2 },
      transactionId: 'tx-789',
      hops: [],
      messageID: 'msg-000',
      messageType: 'reply',
      data: undefined,
      timestamp: Date.now(),
    }

    const queuedMessage: QueuedMessage = {
      resolvedDestination: 'popup',
      message: mockMessage,
    }

    expect(queuedMessage.resolvedDestination).toBe('popup')
  })

  it('should accept message with err property', () => {
    const mockMessage: InternalMessage = {
      origin: { context: 'window', tabId: 3 },
      destination: { context: 'background', tabId: 3 },
      transactionId: 'tx-err',
      hops: ['window', 'content-script'],
      messageID: 'msg-err',
      messageType: 'reply',
      err: { message: 'Something went wrong' },
      timestamp: Date.now(),
    }

    const queuedMessage: QueuedMessage = {
      resolvedDestination: 'background',
      message: mockMessage,
    }

    expect(queuedMessage.message.err).toEqual({ message: 'Something went wrong' })
  })

  it('should accept message with void data', () => {
    const mockMessage: InternalMessage = {
      origin: { context: 'options', tabId: 4 },
      destination: { context: 'background', tabId: 4 },
      transactionId: 'tx-void',
      hops: [],
      messageID: 'msg-void',
      messageType: 'message',
      data: undefined,
      timestamp: Date.now(),
    }

    const queuedMessage: QueuedMessage = {
      resolvedDestination: 'background',
      message: mockMessage,
    }

    expect(queuedMessage.message.data).toBeUndefined()
  })

  it('should accept message with complex data payload', () => {
    const mockMessage: InternalMessage = {
      origin: { context: 'content-script', tabId: 5, frameId: 0 },
      destination: { context: 'background', tabId: 5 },
      transactionId: 'tx-complex',
      hops: ['content-script'],
      messageID: 'msg-complex',
      messageType: 'message',
      data: { nested: { array: [1, 2, 3], obj: { a: 'b' } } },
      timestamp: Date.now(),
    }

    const queuedMessage: QueuedMessage = {
      resolvedDestination: 'background',
      message: mockMessage,
    }

    expect(queuedMessage.message.data).toEqual({ nested: { array: [1, 2, 3], obj: { a: 'b' } } })
  })
})
