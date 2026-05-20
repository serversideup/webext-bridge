import browser from 'webextension-polyfill'

// Mock webextension-polyfill
jest.mock('webextension-polyfill', () => {
  const mockPort = {
    name: '',
    sender: { tab: { id: 1 }, frameId: 0 },
    onDisconnect: { addListener: jest.fn() },
    onMessage: { addListener: jest.fn() },
    postMessage: jest.fn(),
  }

  return {
    runtime: {
      connect: jest.fn(() => mockPort),
      onMessage: {
        addListener: jest.fn(),
      },
    },
  }
})

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

describe('options', () => {
  let optionsModule: typeof import('./options')

  beforeEach(async () => {
    uuidCounter = 0

    // Use isolateModules to get a fresh instance of the module
    await new Promise<void>((resolve) => {
      jest.isolateModules(() => {
        import('./options').then((mod) => {
          optionsModule = mod
          resolve()
        })
      })
    })
  })

  describe('sendMessage', () => {
    it('should be a function', () => {
      expect(typeof optionsModule.sendMessage).toBe('function')
    })

    it('should return a promise', () => {
      const messageID = 'test-message'
      const data = { foo: 'bar' }

      const result = optionsModule.sendMessage(messageID, data, 'background')

      expect(result).toBeInstanceOf(Promise)
    })
  })

  describe('onMessage', () => {
    it('should be a function', () => {
      expect(typeof optionsModule.onMessage).toBe('function')
    })

    it('should register a message handler and return unsubscribe function', () => {
      const messageID = 'test-message'
      const callback = jest.fn().mockResolvedValue({ response: 'ok' })

      const unsubscribe = optionsModule.onMessage(messageID, callback)

      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('openStream', () => {
    it('should be a function', () => {
      expect(typeof optionsModule.openStream).toBe('function')
    })
  })

  describe('onOpenStreamChannel', () => {
    it('should be a function', () => {
      expect(typeof optionsModule.onOpenStreamChannel).toBe('function')
    })
  })

  describe('exported API', () => {
    it('should export sendMessage function', () => {
      expect(optionsModule.sendMessage).toBeDefined()
      expect(typeof optionsModule.sendMessage).toBe('function')
    })

    it('should export onMessage function', () => {
      expect(optionsModule.onMessage).toBeDefined()
      expect(typeof optionsModule.onMessage).toBe('function')
    })

    it('should export openStream function', () => {
      expect(optionsModule.openStream).toBeDefined()
      expect(typeof optionsModule.openStream).toBe('function')
    })

    it('should export onOpenStreamChannel function', () => {
      expect(optionsModule.onOpenStreamChannel).toBeDefined()
      expect(typeof optionsModule.onOpenStreamChannel).toBe('function')
    })
  })

  describe('module initialization', () => {
    it('should initialize with options context', async () => {
      // The module should initialize without errors
      expect(optionsModule).toBeDefined()
    })

    it('should have all exports as proper functions', () => {
      expect(typeof optionsModule.sendMessage).toBe('function')
      expect(typeof optionsModule.onMessage).toBe('function')
      expect(typeof optionsModule.openStream).toBe('function')
      expect(typeof optionsModule.onOpenStreamChannel).toBe('function')
    })
  })

  describe('sendMessage with different destinations', () => {
    it('should return promise when sending to background by default', () => {
      const messageID = 'test-message'
      const data = { test: 'data' }

      const result = optionsModule.sendMessage(messageID, data)

      expect(result).toBeInstanceOf(Promise)
    })

    it('should return promise when sending to content-script', () => {
      const messageID = 'test-message'
      const data = { test: 'data' }

      const result = optionsModule.sendMessage(messageID, data, 'content-script')

      expect(result).toBeInstanceOf(Promise)
    })

    it('should return promise when sending to popup', () => {
      const messageID = 'test-message'
      const data = { test: 'data' }

      const result = optionsModule.sendMessage(messageID, data, 'popup')

      expect(result).toBeInstanceOf(Promise)
    })

    it('should return promise when sending to devtools', () => {
      const messageID = 'test-message'
      const data = { test: 'data' }

      const result = optionsModule.sendMessage(messageID, data, 'devtools')

      expect(result).toBeInstanceOf(Promise)
    })

    it('should throw for invalid destination', () => {
      const messageID = 'test-message'
      const data = { test: 'data' }

      // Passing an invalid destination should throw
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        optionsModule.sendMessage(messageID, data, { context: undefined as any, tabId: null })
      }).toThrow()
    })
  })

  describe('onMessage handler', () => {
    it('should handle async message handlers', async () => {
      const messageID = 'async-test'
      const expectedResult = { async: 'result' }
      const callback = jest.fn().mockResolvedValue(expectedResult)

      optionsModule.onMessage(messageID, callback)

      // Handler is registered, verify unsubscribe works
      const unsubscribe = optionsModule.onMessage(`${messageID}-2`, callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should handle sync message handlers', () => {
      const messageID = 'sync-test'
      const expectedResult = { sync: 'result' }
      const callback = jest.fn().mockReturnValue(expectedResult)

      optionsModule.onMessage(messageID, callback)

      expect(callback).not.toHaveBeenCalled() // Not called until message received
    })

    it('should allow multiple message handlers for different message IDs', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      const unsubscribe1 = optionsModule.onMessage('message-1', callback1)
      const unsubscribe2 = optionsModule.onMessage('message-2', callback2)

      expect(typeof unsubscribe1).toBe('function')
      expect(typeof unsubscribe2).toBe('function')
    })
  })

  describe('stream operations', () => {
    it('openStream should return a promise', async () => {
      const promise = optionsModule.openStream('test-channel', 'background')

      expect(promise).toBeInstanceOf(Promise)
    })

    it('onOpenStreamChannel should register a callback', () => {
      const callback = jest.fn()

      expect(() => {
        optionsModule.onOpenStreamChannel('test-channel', callback)
      }).not.toThrow()
    })

    it('should throw when registering duplicate stream channel', () => {
      const callback = jest.fn()

      optionsModule.onOpenStreamChannel('duplicate-channel', callback)

      expect(() => {
        optionsModule.onOpenStreamChannel('duplicate-channel', callback)
      }).toThrow('webext-bridge: This channel has already been claimed')
    })
  })

  describe('error handling', () => {
    it('should return promise for message sending', () => {
      const messageID = 'error-test'
      const data = { test: 'data' }

      // This should return a promise without crashing
      const result = optionsModule.sendMessage(messageID, data)
      expect(result).toBeInstanceOf(Promise)
    })

    it('should handle callback errors', async () => {
      const messageID = 'error-callback'
      const error = new Error('Handler error')
      const callback = jest.fn().mockRejectedValue(error)

      optionsModule.onMessage(messageID, callback)

      // Handler registered successfully even though it throws
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('type safety', () => {
    it('should accept string data', () => {
      const messageID = 'string-data'
      const data = 'test string'

      const result = optionsModule.sendMessage(messageID, data)
      expect(result).toBeInstanceOf(Promise)
    })

    it('should accept number data', () => {
      const messageID = 'number-data'
      const data = 42

      const result = optionsModule.sendMessage(messageID, data)
      expect(result).toBeInstanceOf(Promise)
    })

    it('should accept boolean data', () => {
      const messageID = 'boolean-data'
      const data = true

      const result = optionsModule.sendMessage(messageID, data)
      expect(result).toBeInstanceOf(Promise)
    })

    it('should accept null data', () => {
      const messageID = 'null-data'
      const data = null

      const result = optionsModule.sendMessage(messageID, data)
      expect(result).toBeInstanceOf(Promise)
    })

    it('should accept array data', () => {
      const messageID = 'array-data'
      const data = [1, 2, 3]

      const result = optionsModule.sendMessage(messageID, data)
      expect(result).toBeInstanceOf(Promise)
    })

    it('should accept object data', () => {
      const messageID = 'object-data'
      const data = { nested: { value: 'test' } }

      const result = optionsModule.sendMessage(messageID, data)
      expect(result).toBeInstanceOf(Promise)
    })
  })
})
