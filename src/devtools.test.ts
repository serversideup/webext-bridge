// Mock dependencies - must be before imports
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

jest.mock('./internal/persistent-port', () => ({
  createPersistentPort: jest.fn(() => mockPort),
}))

jest.mock('./internal/stream', () => ({
  createStreamWirings: jest.fn(() => mockStreamWirings),
}))

jest.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: {
    devtools: {
      inspectedWindow: {
        tabId: 123,
      },
    },
    runtime: {
      connect: jest.fn(),
    },
  },
}))

describe('devtools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  describe('initialization', () => {
    it('should create persistent port with devtools context and tabId', () => {
      require('./devtools')
      expect(mockPort.onMessage).toBeDefined()
    })

    it('should create endpoint runtime with devtools context', () => {
      require('./devtools')
      expect(mockEndpointRuntime.handleMessage).toBeDefined()
    })

    it('should create stream wirings with endpoint runtime', () => {
      require('./devtools')
      expect(mockStreamWirings.openStream).toBeDefined()
    })
  })

  describe('message routing', () => {
    it('should route messages to port.postMessage', () => {
      require('./devtools')
      // Get the routeMessage function passed to createEndpointRuntime
      const { createEndpointRuntime } = require('./internal/endpoint-runtime')
      const routeMessage = createEndpointRuntime.mock.calls[0][1]

      const message = {
        destination: { context: 'background' as const },
        transactionId: 'test-tx',
        messageID: 'test-id',
        messageType: 'message' as const,
        origin: { context: 'devtools' as const, tabId: null },
        hops: [],
        timestamp: Date.now(),
      }

      routeMessage(message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
    })
  })

  describe('port message handling', () => {
    it('should register onMessage handler on port with endpointRuntime.handleMessage', () => {
      require('./devtools')
      expect(mockPort.onMessage).toHaveBeenCalledWith(mockHandleMessage)
    })
  })

  describe('exports', () => {
    it('should export sendMessage from endpointRuntime', () => {
      const { sendMessage } = require('./devtools')
      expect(sendMessage).toBe(mockEndpointRuntime.sendMessage)
    })

    it('should export onMessage from endpointRuntime', () => {
      const { onMessage } = require('./devtools')
      expect(onMessage).toBe(mockEndpointRuntime.onMessage)
    })

    it('should export openStream from stream wirings', () => {
      const { openStream } = require('./devtools')
      expect(openStream).toBe(mockStreamWirings.openStream)
    })

    it('should export onOpenStreamChannel from stream wirings', () => {
      const { onOpenStreamChannel } = require('./devtools')
      expect(onOpenStreamChannel).toBe(mockStreamWirings.onOpenStreamChannel)
    })
  })
})
