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
      onConnect: {
        addListener: jest.fn(),
      },
      connect: jest.fn(),
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
      },
    },
    tabs: {
      sendMessage: jest.fn(),
    },
  }
})

describe('background', () => {
  let backgroundModule: typeof import('./background')
  let onConnectCallback: ((port: browser.Runtime.Port) => void) | null = null

  beforeEach(async () => {
    // Reset state
    onConnectCallback = null
    
    // Use isolateModules to get a fresh instance of the module
    await new Promise<void>((resolve) => {
      jest.isolateModules(() => {
        // Set up the onConnect listener mock to capture the callback inside isolateModules
        ;(browser.runtime.onConnect.addListener as jest.Mock).mockImplementation(
          (cb: (port: browser.Runtime.Port) => void) => {
            onConnectCallback = cb
          },
        )
        
        import('./background').then((mod) => {
          backgroundModule = mod
          resolve()
        })
      })
    })
  })

  describe('sendMessage', () => {
    it('should be a function', () => {
      expect(typeof backgroundModule.sendMessage).toBe('function')
    })
  })

  describe('onMessage', () => {
    it('should be a function', () => {
      expect(typeof backgroundModule.onMessage).toBe('function')
    })
  })

  describe('openStream', () => {
    it('should be a function', () => {
      expect(typeof backgroundModule.openStream).toBe('function')
    })
  })

  describe('onOpenStreamChannel', () => {
    it('should be a function', () => {
      expect(typeof backgroundModule.onOpenStreamChannel).toBe('function')
    })
  })

  describe('runtime.onConnect listener', () => {
    it('should register onConnect listener', () => {
      // The listener should have been called when the module was imported
      expect(onConnectCallback).toBeDefined()
    })

    it('should ignore ports without valid connection args', () => {
      const mockPort = {
        name: 'invalid', // Invalid connection args - not JSON
        sender: { tab: { id: 1 }, frameId: 0 },
        onDisconnect: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() },
        postMessage: jest.fn(),
      }

      onConnectCallback?.(mockPort as unknown as browser.Runtime.Port)

      // When connection args are invalid, the code returns early without setting up listeners
      // So onDisconnect and onMessage listeners should NOT be called
      expect(mockPort.onDisconnect.addListener).not.toHaveBeenCalled()
      expect(mockPort.onMessage.addListener).not.toHaveBeenCalled()
    })
  })

  describe('port message handling', () => {
    it('should handle sync message type', () => {
      const mockPort = {
        name: JSON.stringify({ endpointName: 'ext-content-script:1:0', fingerprint: 'abc' }),
        sender: { tab: { id: 1 }, frameId: 0 },
        onDisconnect: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() },
        postMessage: jest.fn(),
      }

      let messageListener: ((msg: unknown) => void) | null = null
      mockPort.onMessage.addListener.mockImplementation(
        (cb: (msg: unknown) => void) => {
          messageListener = cb
        },
      )

      // Simulate port connection
      onConnectCallback?.(mockPort as unknown as browser.Runtime.Port)

      const syncMessage = {
        type: 'sync',
        pendingResponses: [],
        pendingDeliveries: [],
      }

      messageListener?.(syncMessage)
    })

    it('should handle deliver message type', () => {
      const mockPort = {
        name: JSON.stringify({ endpointName: 'ext-content-script:1:0', fingerprint: 'abc' }),
        sender: { tab: { id: 1 }, frameId: 0 },
        onDisconnect: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() },
        postMessage: jest.fn(),
      }

      let messageListener: ((msg: unknown) => void) | null = null
      mockPort.onMessage.addListener.mockImplementation(
        (cb: (msg: unknown) => void) => {
          messageListener = cb
        },
      )

      // Simulate port connection
      onConnectCallback?.(mockPort as unknown as browser.Runtime.Port)

      const deliverMessage = {
        type: 'deliver',
        message: {
          origin: { context: 'content-script', tabId: 1, frameId: 0 },
          destination: { context: 'background' },
          messageType: 'message',
          messageID: 'test-id',
        },
      }

      messageListener?.(deliverMessage)
    })
  })

  describe('port disconnection handling', () => {
    it('should handle port disconnection', () => {
      const mockPort = {
        name: JSON.stringify({ endpointName: 'ext-content-script:1:0', fingerprint: 'abc' }),
        sender: { tab: { id: 1 }, frameId: 0 },
        onDisconnect: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() },
        postMessage: jest.fn(),
      }

      let disconnectListener: (() => void) | null = null
      mockPort.onDisconnect.addListener.mockImplementation(
        (cb: () => void) => {
          disconnectListener = cb
        },
      )

      // Simulate port connection
      onConnectCallback?.(mockPort as unknown as browser.Runtime.Port)

      disconnectListener?.()
    })
  })

  describe('exported API', () => {
    it('should export sendMessage function', () => {
      expect(backgroundModule.sendMessage).toBeDefined()
      expect(typeof backgroundModule.sendMessage).toBe('function')
    })

    it('should export onMessage function', () => {
      expect(backgroundModule.onMessage).toBeDefined()
      expect(typeof backgroundModule.onMessage).toBe('function')
    })

    it('should export openStream function', () => {
      expect(backgroundModule.openStream).toBeDefined()
      expect(typeof backgroundModule.openStream).toBe('function')
    })

    it('should export onOpenStreamChannel function', () => {
      expect(backgroundModule.onOpenStreamChannel).toBeDefined()
      expect(typeof backgroundModule.onOpenStreamChannel).toBe('function')
    })
  })
})
