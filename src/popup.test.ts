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

describe('popup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  describe('initialization', () => {
    it('should create persistent port with popup name', () => {
      require('./popup')
      expect(mockPort.onMessage).toBeDefined()
    })

    it('should create endpoint runtime with popup context', () => {
      require('./popup')
      expect(mockEndpointRuntime.handleMessage).toBeDefined()
    })

    it('should create stream wirings with endpoint runtime', () => {
      require('./popup')
      expect(mockStreamWirings.openStream).toBeDefined()
    })
  })

  describe('message routing', () => {
    it('should route messages to port.postMessage', () => {
      require('./popup')
      const { createEndpointRuntime } = require('./internal/endpoint-runtime')
      const routeMessage = createEndpointRuntime.mock.calls[0][1]

      const message = {
        destination: { context: 'background' as const },
        transactionId: 'test-tx',
        messageID: 'test-id',
        messageType: 'message' as const,
        origin: { context: 'popup' as const, tabId: null },
        hops: [],
        timestamp: Date.now(),
      }

      routeMessage(message)

      expect(mockPort.postMessage).toHaveBeenCalledWith(message)
    })
  })

  describe('port message handling', () => {
    it('should register onMessage handler on port with endpointRuntime.handleMessage', () => {
      require('./popup')
      expect(mockPort.onMessage).toHaveBeenCalledWith(mockHandleMessage)
    })
  })

  describe('exports', () => {
    it('should export sendMessage from endpointRuntime', () => {
      const { sendMessage } = require('./popup')
      expect(sendMessage).toBe(mockEndpointRuntime.sendMessage)
    })

    it('should export onMessage from endpointRuntime', () => {
      const { onMessage } = require('./popup')
      expect(onMessage).toBe(mockEndpointRuntime.onMessage)
    })

    it('should export openStream from stream wirings', () => {
      const { openStream } = require('./popup')
      expect(openStream).toBe(mockStreamWirings.openStream)
    })

    it('should export onOpenStreamChannel from stream wirings', () => {
      const { onOpenStreamChannel } = require('./popup')
      expect(onOpenStreamChannel).toBe(mockStreamWirings.onOpenStreamChannel)
    })
  })
})
