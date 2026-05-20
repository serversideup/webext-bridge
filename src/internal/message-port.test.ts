import { getMessagePort } from './message-port'

// Mock window for Node.js test environment
const mockWindow = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  postMessage: jest.fn(),
}

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true,
  configurable: true,
})

// Track created channels for testing
let createdChannels: Array<{ port1: any; port2: any }> = []

// Mock MessageChannel
class MockMessageChannel {
  port1: any
  port2: any

  constructor() {
    this.port1 = {
      onmessage: null as ((e: MessageEvent) => void) | null,
      postMessage: jest.fn(),
    }
    this.port2 = {
      onmessage: null as ((e: MessageEvent) => void) | null,
      postMessage: jest.fn(),
    }
    createdChannels.push({ port1: this.port1, port2: this.port2 })
  }
}

Object.defineProperty(global, 'MessageChannel', {
  value: MockMessageChannel,
  writable: true,
  configurable: true,
})

describe('getMessagePort', () => {
  let addEventListenerSpy: jest.SpyInstance
  let removeEventListenerSpy: jest.SpyInstance
  let postMessageSpy: jest.SpyInstance
  let messageListeners: Array<(e: MessageEvent) => void>

  beforeEach(() => {
    messageListeners = []
    createdChannels = []

    jest.clearAllMocks()

    addEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'message') {
        messageListeners.push(handler as (e: MessageEvent) => void)
      }
    })

    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener').mockImplementation((event, handler) => {
      if (event === 'message') {
        messageListeners = messageListeners.filter((listener) => listener !== handler)
      }
    })

    postMessageSpy = jest.spyOn(window, 'postMessage').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    // Clear the promise cache by resetting the module
    jest.resetModules()
  })

  const createMockMessageEvent = (data: any, ports: MessagePort[] = []): MessageEvent => {
    return {
      data,
      ports,
      lastEventId: '',
      origin: '',
      source: null,
    } as unknown as MessageEvent
  }

  const createMockPort = () => {
    const port = {
      onmessage: null as ((e: MessageEvent) => void) | null,
      postMessage: jest.fn(),
    }
    return port
  }

  describe('when thisContext is "content-script"', () => {
    it('should offer messaging port immediately', async () => {
      const { getMessagePort: getPort } = await import('./message-port')
      const onMessage = jest.fn()
      const mockPort = createMockPort()

      const portPromise = getPort('content-script', 'test-namespace', onMessage)

      // postMessage should be called with the port offer
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          cmd: 'webext-port-offer',
          scope: 'test-namespace',
          context: 'content-script',
        },
        '*',
        expect.any(Array),
      )

      // Simulate port acceptance from the other side
      const acceptEvent = createMockMessageEvent(
        { cmd: 'webext-port-offer', scope: 'test-namespace', context: 'window' },
        [mockPort as unknown as MessagePort],
      )
      messageListeners.forEach((listener) => listener(acceptEvent))

      const port = await portPromise
      expect(port).toBe(mockPort)
    })

    it('should handle incoming port offer from window context', async () => {
      const { getMessagePort: getPort } = await import('./message-port')
      const onMessage = jest.fn()
      const mockPort = createMockPort()

      const portPromise = getPort('content-script', 'test-namespace', onMessage)

      // Simulate receiving a port offer from window context
      const offerEvent = createMockMessageEvent(
        { cmd: 'webext-port-offer', scope: 'test-namespace', context: 'window' },
        [mockPort as unknown as MessagePort],
      )
      messageListeners.forEach((listener) => listener(offerEvent))

      const port = await portPromise
      expect(port).toBe(mockPort)
      expect(mockPort.postMessage).toHaveBeenCalledWith('port-accepted')
    })

    it('should ignore port offers with different namespace', async () => {
      const { getMessagePort: getPort } = await import('./message-port')
      const onMessage = jest.fn()
      const mockPort1 = createMockPort()
      const mockPort2 = createMockPort()

      const portPromise = getPort('content-script', 'test-namespace', onMessage)

      // First, send a port offer with wrong namespace (should be ignored)
      const wrongNamespaceEvent = createMockMessageEvent(
        { cmd: 'webext-port-offer', scope: 'wrong-namespace', context: 'window' },
        [mockPort1 as unknown as MessagePort],
      )
      messageListeners.forEach((listener) => listener(wrongNamespaceEvent))

      // Then, send a correct port offer
      const correctEvent = createMockMessageEvent(
        { cmd: 'webext-port-offer', scope: 'test-namespace', context: 'window' },
        [mockPort2 as unknown as MessagePort],
      )
      messageListeners.forEach((listener) => listener(correctEvent))

      const port = await portPromise
      expect(port).toBe(mockPort2)
    })

    it('should ignore port offers from same context', async () => {
      const { getMessagePort: getPort } = await import('./message-port')
      const onMessage = jest.fn()
      const mockPort1 = createMockPort()
      const mockPort2 = createMockPort()

      const portPromise = getPort('content-script', 'test-namespace', onMessage)

      // First, send a port offer from same context (should be ignored)
      const sameContextEvent = createMockMessageEvent(
        { cmd: 'webext-port-offer', scope: 'test-namespace', context: 'content-script' },
        [mockPort1 as unknown as MessagePort],
      )
      messageListeners.forEach((listener) => listener(sameContextEvent))

      // Then, send a correct port offer from window context
      const correctEvent = createMockMessageEvent(
        { cmd: 'webext-port-offer', scope: 'test-namespace', context: 'window' },
        [mockPort2 as unknown as MessagePort],
      )
      messageListeners.forEach((listener) => listener(correctEvent))

      const port = await portPromise
      expect(port).toBe(mockPort2)
    })
  })

  describe('when thisContext is "window"', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should delay offering port by one tick', async () => {
      const { getMessagePort: getPort } = await import('./message-port')
      const onMessage = jest.fn()

      const portPromise = getPort('window', 'test-namespace', onMessage)

      // postMessage should NOT be called immediately
      expect(postMessageSpy).not.toHaveBeenCalled()

      // Advance timers to trigger the delayed offer
      jest.runAllTimers()

      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          cmd: 'webext-port-offer',
          scope: 'test-namespace',
          context: 'window',
        },
        '*',
        expect.any(Array),
      )
    })

    it('should accept incoming port offer from content-script', async () => {
      const { getMessagePort: getPort } = await import('./message-port')
      const onMessage = jest.fn()
      const mockPort = createMockPort()

      const portPromise = getPort('window', 'test-namespace', onMessage)

      // Simulate receiving a port offer from content-script context
      const offerEvent = createMockMessageEvent(
        { cmd: 'webext-port-offer', scope: 'test-namespace', context: 'content-script' },
        [mockPort as unknown as MessagePort],
      )
      messageListeners.forEach((listener) => listener(offerEvent))

      const port = await portPromise
      expect(port).toBe(mockPort)
      expect(mockPort.postMessage).toHaveBeenCalledWith('port-accepted')
    })

    it('should handle port-accepted message and resolve', async () => {
      const { getMessagePort: getPort } = await import('./message-port')
      const onMessage = jest.fn()

      const portPromise = getPort('window', 'test-namespace', onMessage)

      // Advance timers to trigger the port offer
      jest.runAllTimers()

      // Get the port1 from the created channel (this is what the code listens on)
      const channel = createdChannels[0]
      expect(channel).toBeDefined()

      // Simulate the port-accepted response on port1
      channel.port1.onmessage?.({ data: 'port-accepted' } as MessageEvent)

      const port = await portPromise
      expect(port).toBe(channel.port1)
    })

    it('should forward messages to onMessage callback', async () => {
      const { getMessagePort: getPort } = await import('./message-port')
      const onMessage = jest.fn()

      const portPromise = getPort('window', 'test-namespace', onMessage)

      // Advance timers to trigger the port offer
      jest.runAllTimers()

      // Get the port1 from the created channel
      const channel = createdChannels[0]
      expect(channel).toBeDefined()

      // Simulate a message event (not port-accepted)
      const messageData = { type: 'custom-message', payload: 'test' }
      channel.port1.onmessage?.({ data: messageData } as MessageEvent)

      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
        data: messageData,
      }))
    })
  })

  describe('caching behavior', () => {
    it('should return the same promise on subsequent calls', async () => {
      const { getMessagePort: getPort1 } = await import('./message-port')
      const { getMessagePort: getPort2 } = await import('./message-port')

      const onMessage1 = jest.fn()
      const onMessage2 = jest.fn()

      const promise1 = getPort1('content-script', 'test-namespace', onMessage1)
      const promise2 = getPort2('content-script', 'test-namespace', onMessage2)

      expect(promise1).toBe(promise2)
    })
  })

  describe('message handler setup', () => {
    it('should set onmessage handler on the resolved port', async () => {
      const { getMessagePort: getPort } = await import('./message-port')
      const onMessage = jest.fn()
      const mockPort = createMockPort()

      const portPromise = getPort('content-script', 'test-namespace', onMessage)

      // Simulate port acceptance
      const acceptEvent = createMockMessageEvent(
        { cmd: 'webext-port-offer', scope: 'test-namespace', context: 'window' },
        [mockPort as unknown as MessagePort],
      )
      messageListeners.forEach((listener) => listener(acceptEvent))

      await portPromise

      // The onmessage handler should be set
      expect(mockPort.onmessage).toBeDefined()
    })
  })
})
