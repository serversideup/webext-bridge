// Mock dependencies - must be before imports
const mockWin = {
  onMessage: jest.fn(),
  postMessage: jest.fn(),
  setNamespace: jest.fn(),
  enable: jest.fn(),
}

const mockPort = {
  onMessage: jest.fn(),
  postMessage: jest.fn(),
  onFailure: jest.fn(),
}

const mockHandleMessage = jest.fn()
const mockEndpointRuntime = {
  handleMessage: mockHandleMessage,
  sendMessage: jest.fn(),
  onMessage: jest.fn(),
  endTransaction: jest.fn(),
}

const mockStreamWirings = {
  openStream: jest.fn(),
  onOpenStreamChannel: jest.fn(),
}

jest.mock('./internal/endpoint-runtime', () => ({
  createEndpointRuntime: jest.fn(() => mockEndpointRuntime),
}))

jest.mock('./internal/post-message', () => ({
  usePostMessaging: jest.fn(() => mockWin),
}))

jest.mock('./internal/persistent-port', () => ({
  createPersistentPort: jest.fn(() => mockPort),
}))

jest.mock('./internal/stream', () => ({
  createStreamWirings: jest.fn(() => mockStreamWirings),
}))

describe('content-script', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  describe('initialization', () => {
    it('should create post messaging endpoint for content-script', () => {
      require('./content-script')
      expect(mockWin.onMessage).toBeDefined()
    })

    it('should create persistent port', () => {
      require('./content-script')
      expect(mockPort.onMessage).toBeDefined()
    })

    it('should create endpoint runtime with content-script context', () => {
      require('./content-script')
      expect(mockEndpointRuntime.handleMessage).toBeDefined()
    })

    it('should create stream wirings with endpoint runtime', () => {
      require('./content-script')
      expect(mockStreamWirings.openStream).toBeDefined()
    })
  })

  describe('message routing', () => {
    it('should route window destination messages to win.postMessage', () => {
      require('./content-script')
      // Get the routeMessage function passed to createEndpointRuntime
      const { createEndpointRuntime } = require('./internal/endpoint-runtime')
      const routeMessage = createEndpointRuntime.mock.calls[0][1]

      const message = {
        destination: { context: 'window' as const },
        transactionId: 'test-tx',
        messageID: 'test-id',
        messageType: 'message' as const,
        origin: { context: 'content-script' as const, tabId: null },
        hops: [],
        timestamp: Date.now(),
      }

      routeMessage(message)

      expect(mockWin.postMessage).toHaveBeenCalledWith(message)
      expect(mockPort.postMessage).not.toHaveBeenCalled()
    })

    it('should route non-window destination messages to port.postMessage', () => {
      require('./content-script')
      const { createEndpointRuntime } = require('./internal/endpoint-runtime')
      const routeMessage = createEndpointRuntime.mock.calls[0][1]

      const message = {
        destination: { context: 'background' as const },
        transactionId: 'test-tx',
        messageID: 'test-id',
        messageType: 'message' as const,
        origin: { context: 'content-script' as const, tabId: null },
        hops: [],
        timestamp: Date.now(),
      }

      routeMessage(message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
      expect(mockWin.postMessage).not.toHaveBeenCalled()
    })
  })

  describe('window message handling', () => {
    it('should register onMessage handler on win', () => {
      require('./content-script')
      expect(mockWin.onMessage).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should handle incoming window messages with origin context set to window', () => {
      require('./content-script')
      const winMessageHandler = mockWin.onMessage.mock.calls[0][0]

      const incomingMessage = {
        transactionId: 'test-tx',
        messageID: 'test-id',
        messageType: 'message' as const,
        data: { foo: 'bar' },
        timestamp: Date.now(),
      }

      winMessageHandler(incomingMessage)

      expect(mockHandleMessage).toHaveBeenCalledWith({
        ...incomingMessage,
        origin: {
          context: 'window',
          tabId: null,
        },
      })
    })
  })

  describe('port message handling', () => {
    it('should register onMessage handler on port', () => {
      require('./content-script')
      expect(mockPort.onMessage).toHaveBeenCalledWith(mockHandleMessage)
    })
  })

  describe('port failure handling', () => {
    it('should register onFailure handler on port', () => {
      require('./content-script')
      expect(mockPort.onFailure).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should post error message to win when origin is window', () => {
      require('./content-script')
      const failureHandler = mockPort.onFailure.mock.calls[0][0]

      const message = {
        origin: { context: 'window' as const },
        transactionId: 'test-tx',
      }

      failureHandler(message)

      expect(mockWin.postMessage).toHaveBeenCalledWith({
        type: 'error',
        transactionID: 'test-tx',
      })
      expect(mockEndpointRuntime.endTransaction).not.toHaveBeenCalled()
    })

    it('should call endTransaction when origin is not window', () => {
      require('./content-script')
      const failureHandler = mockPort.onFailure.mock.calls[0][0]

      const message = {
        origin: { context: 'background' as const },
        transactionId: 'test-tx',
      }

      failureHandler(message)

      expect(mockWin.postMessage).not.toHaveBeenCalled()
      expect(mockEndpointRuntime.endTransaction).toHaveBeenCalledWith('test-tx')
    })
  })

  describe('allowWindowMessaging', () => {
    it('should set namespace on win', () => {
      const { allowWindowMessaging } = require('./content-script')
      allowWindowMessaging('test-namespace')

      expect(mockWin.setNamespace).toHaveBeenCalledWith('test-namespace')
    })

    it('should enable win messaging', () => {
      const { allowWindowMessaging } = require('./content-script')
      allowWindowMessaging('test-namespace')

      expect(mockWin.enable).toHaveBeenCalled()
    })

    it('should set namespace before enabling', () => {
      const { allowWindowMessaging } = require('./content-script')
      allowWindowMessaging('my-namespace')

      expect(mockWin.setNamespace).toHaveBeenCalledWith('my-namespace')
      expect(mockWin.enable).toHaveBeenCalled()
    })
  })

  describe('exports', () => {
    it('should export sendMessage from endpointRuntime', () => {
      const { sendMessage } = require('./content-script')
      expect(sendMessage).toBe(mockEndpointRuntime.sendMessage)
    })

    it('should export onMessage from endpointRuntime', () => {
      const { onMessage } = require('./content-script')
      expect(onMessage).toBe(mockEndpointRuntime.onMessage)
    })

    it('should export openStream from stream wirings', () => {
      const { openStream } = require('./content-script')
      expect(openStream).toBe(mockStreamWirings.openStream)
    })

    it('should export onOpenStreamChannel from stream wirings', () => {
      const { onOpenStreamChannel } = require('./content-script')
      expect(onOpenStreamChannel).toBe(mockStreamWirings.onOpenStreamChannel)
    })
  })
})
