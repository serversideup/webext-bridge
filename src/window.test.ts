// Mock dependencies - must be before imports
const mockWin = {
  postMessage: jest.fn(),
  onMessage: jest.fn(),
  setNamespace: jest.fn(),
  enable: jest.fn(),
}

const mockHandleMessage = jest.fn()
const mockEndTransaction = jest.fn()
const mockEndpointRuntime = {
  handleMessage: mockHandleMessage,
  sendMessage: jest.fn(),
  onMessage: jest.fn(),
  endTransaction: mockEndTransaction,
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

jest.mock('./internal/stream', () => ({
  createStreamWirings: jest.fn(() => mockStreamWirings),
}))

describe('window', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  describe('initialization', () => {
    it('should create post messaging hook with window context', () => {
      require('./window')
      const { usePostMessaging } = require('./internal/post-message')
      expect(usePostMessaging).toHaveBeenCalledWith('window')
    })

    it('should create endpoint runtime with window context', () => {
      require('./window')
      const { createEndpointRuntime } = require('./internal/endpoint-runtime')
      expect(createEndpointRuntime).toHaveBeenCalledWith('window', expect.any(Function))
    })

    it('should create stream wirings with endpoint runtime', () => {
      require('./window')
      const { createStreamWirings } = require('./internal/stream')
      expect(createStreamWirings).toHaveBeenCalledWith(mockEndpointRuntime)
    })
  })

  describe('message routing', () => {
    it('should route messages to win.postMessage', () => {
      require('./window')
      const { createEndpointRuntime } = require('./internal/endpoint-runtime')
      const routeMessage = createEndpointRuntime.mock.calls[0][1]

      const message = {
        destination: { context: 'background' as const },
        transactionId: 'test-tx',
        messageID: 'test-id',
        messageType: 'message' as const,
        origin: { context: 'window' as const, tabId: null },
        hops: [],
        timestamp: Date.now(),
      }

      routeMessage(message)

      expect(mockWin.postMessage).toHaveBeenCalledWith(message)
    })
  })

  describe('window message handling', () => {
    it('should register onMessage handler on window that calls endpointRuntime.handleMessage for regular messages', () => {
      require('./window')
      const onMessageCallback = mockWin.onMessage.mock.calls[0][0]

      const message = {
        messageID: 'test-id',
        data: { foo: 'bar' },
        messageType: 'message' as const,
        transactionId: 'test-tx',
        origin: { context: 'background', tabId: null },
        destination: { context: 'window', tabId: null, frameId: null },
        hops: [],
        timestamp: Date.now(),
      }

      onMessageCallback(message)

      expect(mockHandleMessage).toHaveBeenCalledWith(message)
    })

    it('should call endpointRuntime.endTransaction when message has type and transactionID', () => {
      require('./window')
      const onMessageCallback = mockWin.onMessage.mock.calls[0][0]

      const message = {
        type: 'error',
        transactionID: 'test-tx',
      }

      onMessageCallback(message)

      expect(mockEndTransaction).toHaveBeenCalledWith('test-tx')
    })

    it('should call endpointRuntime.handleMessage when message does not have type property', () => {
      require('./window')
      const onMessageCallback = mockWin.onMessage.mock.calls[0][0]

      const message = {
        messageID: 'test-id',
        data: { foo: 'bar' },
        messageType: 'message' as const,
        transactionId: 'test-tx',
        origin: { context: 'background', tabId: null },
        destination: { context: 'window', tabId: null, frameId: null },
        hops: [],
        timestamp: Date.now(),
      }

      onMessageCallback(message)

      expect(mockHandleMessage).toHaveBeenCalledWith(message)
      expect(mockEndTransaction).not.toHaveBeenCalled()
    })

    it('should call endpointRuntime.handleMessage when message does not have transactionID property', () => {
      require('./window')
      const onMessageCallback = mockWin.onMessage.mock.calls[0][0]

      const message = {
        type: 'something',
        messageID: 'test-id',
        data: { foo: 'bar' },
      }

      onMessageCallback(message)

      expect(mockHandleMessage).toHaveBeenCalledWith(message)
      expect(mockEndTransaction).not.toHaveBeenCalled()
    })
  })

  describe('setNamespace', () => {
    it('should call win.setNamespace with the provided namespace', () => {
      const { setNamespace } = require('./window')

      setNamespace('test-namespace')

      expect(mockWin.setNamespace).toHaveBeenCalledWith('test-namespace')
    })

    it('should call win.enable after setting namespace', () => {
      const { setNamespace } = require('./window')

      setNamespace('test-namespace')

      expect(mockWin.enable).toHaveBeenCalled()
    })

    it('should call win.setNamespace and win.enable in sequence', () => {
      const { setNamespace } = require('./window')

      setNamespace('test-namespace')

      expect(mockWin.setNamespace).toHaveBeenCalled()
      expect(mockWin.enable).toHaveBeenCalled()
    })
  })

  describe('exports', () => {
    it('should export sendMessage from endpointRuntime', () => {
      const { sendMessage } = require('./window')
      expect(sendMessage).toBe(mockEndpointRuntime.sendMessage)
    })

    it('should export onMessage from endpointRuntime', () => {
      const { onMessage } = require('./window')
      expect(onMessage).toBe(mockEndpointRuntime.onMessage)
    })

    it('should export openStream from stream wirings', () => {
      const { openStream } = require('./window')
      expect(openStream).toBe(mockStreamWirings.openStream)
    })

    it('should export onOpenStreamChannel from stream wirings', () => {
      const { onOpenStreamChannel } = require('./window')
      expect(onOpenStreamChannel).toBe(mockStreamWirings.onOpenStreamChannel)
    })
  })

  describe('module initialization order', () => {
    it('should set up window message handler during module initialization', () => {
      require('./window')

      // The onMessage handler should be registered during module initialization
      expect(mockWin.onMessage).toHaveBeenCalled()
    })
  })
})
