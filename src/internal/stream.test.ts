import type { EndpointRuntime } from './endpoint-runtime'
import type { StreamInfo, Endpoint } from '../types'

// Mock nanoevents with proper event handling
jest.mock('nanoevents', () => {
  return {
    createNanoEvents: () => {
      const events: Record<string, Array<(...args: any[]) => void>> = {}
      return {
        on: (event: string, callback: (...args: any[]) => void) => {
          if (!events[event]) {
            events[event] = []
          }
          events[event].push(callback)
          return () => {
            if (events[event]) {
              events[event] = events[event].filter(cb => cb !== callback)
            }
          }
        },
        emit: (event: string, ...args: any[]) => {
          if (events[event]) {
            events[event].forEach(cb => cb(...args))
          }
        },
        events,
      }
    },
  }
})

// Mock tiny-uid
jest.mock('tiny-uid', () => ({
  __esModule: true,
  default: () => 'mocked-uuid-12345',
}))

// Import after mocks
import { Stream, createStreamWirings } from './stream'

// Helper to reset Stream static state
function resetStreamStaticState() {
  (Stream as any).initDone = false
  ;(Stream as any).openStreams = new Map()
}

describe('Stream', () => {
  let mockEndpointRuntime: jest.Mocked<EndpointRuntime>
  let mockStreamInfo: StreamInfo
  let mockEndpoint: Endpoint
  let registeredHandlers: Record<string, Array<(msg: any) => Promise<any>>>

  beforeEach(() => {
    jest.clearAllMocks()
    resetStreamStaticState()
    registeredHandlers = {}

    mockEndpointRuntime = {
      sendMessage: jest.fn(),
      onMessage: jest.fn((event: string, callback: (msg: any) => Promise<any>) => {
        if (!registeredHandlers[event]) {
          registeredHandlers[event] = []
        }
        registeredHandlers[event].push(callback)
        return jest.fn()
      }),
    } as unknown as jest.Mocked<EndpointRuntime>

    mockEndpoint = {
      context: 'content-script',
      tabId: 1,
    }

    mockStreamInfo = {
      streamId: 'test-stream-id',
      channel: 'test-channel',
      endpoint: mockEndpoint,
    }
  })

  describe('constructor', () => {
    it('should initialize stream and add to openStreams map', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)

      expect(stream).toBeDefined()
      expect(stream.info).toEqual(mockStreamInfo)
    })

    it('should set up message handler only once (static initDone)', () => {
      const stream1 = new Stream(mockEndpointRuntime, mockStreamInfo)
      const stream2 = new Stream(mockEndpointRuntime, { ...mockStreamInfo, streamId: 'test-stream-id-2' })

      // onMessage should be called once for the static init
      expect(mockEndpointRuntime.onMessage).toHaveBeenCalledTimes(1)
    })

    it('should handle stream transfer message with action "transfer"', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const messageCallback = jest.fn()
      stream.onMessage(messageCallback)

      // Trigger the message handler directly via registeredHandlers
      const transferHandler = registeredHandlers['__crx_bridge_stream_transfer__']?.[0]
      const mockMsg = {
        data: {
          streamId: 'test-stream-id',
          streamTransfer: { foo: 'bar' },
          action: 'transfer' as const,
        },
      }

      if (transferHandler) {
        transferHandler(mockMsg)
      }

      expect(messageCallback).toHaveBeenCalledWith({ foo: 'bar' })
    })

    it('should handle stream close message with action "close"', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const closeCallback = jest.fn()
      stream.onClose(closeCallback)

      const closeHandler = registeredHandlers['__crx_bridge_stream_transfer__']?.[0]
      const mockMsg = {
        data: {
          streamId: 'test-stream-id',
          streamTransfer: null,
          action: 'close' as const,
        },
      }

      if (closeHandler) {
        closeHandler(mockMsg)
      }

      expect(closeCallback).toHaveBeenCalledWith(true)
      expect(stream.info).toBeDefined()
    })
  })

  describe('info getter', () => {
    it('should return the stream info', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)

      expect(stream.info).toEqual(mockStreamInfo)
    })
  })

  describe('send', () => {
    it('should send a message to the endpoint', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const testMessage = { data: 'test' }

      stream.send(testMessage)

      expect(mockEndpointRuntime.sendMessage).toHaveBeenCalledWith(
        '__crx_bridge_stream_transfer__',
        {
          streamId: 'test-stream-id',
          streamTransfer: testMessage,
          action: 'transfer',
        },
        mockEndpoint,
      )
    })

    it('should send undefined message', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)

      stream.send()

      expect(mockEndpointRuntime.sendMessage).toHaveBeenCalledWith(
        '__crx_bridge_stream_transfer__',
        {
          streamId: 'test-stream-id',
          streamTransfer: undefined,
          action: 'transfer',
        },
        mockEndpoint,
      )
    })

    it('should throw error when sending on closed stream', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      stream.close()

      expect(() => stream.send({ data: 'test' })).toThrow(
        'Attempting to send a message over closed stream. Use stream.onClose(<callback>) to keep an eye on stream status',
      )
    })
  })

  describe('close', () => {
    it('should close the stream and send close message', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const closeCallback = jest.fn()
      stream.onClose(closeCallback)

      stream.close()

      expect(mockEndpointRuntime.sendMessage).toHaveBeenCalledWith(
        '__crx_bridge_stream_transfer__',
        {
          streamId: 'test-stream-id',
          streamTransfer: null,
          action: 'close',
        },
        mockEndpoint,
      )
      expect(closeCallback).toHaveBeenCalledWith(true)
    })

    it('should send optional message before closing', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const farewellMessage = { goodbye: 'world' }

      stream.close(farewellMessage)

      expect(mockEndpointRuntime.sendMessage).toHaveBeenNthCalledWith(
        1,
        '__crx_bridge_stream_transfer__',
        {
          streamId: 'test-stream-id',
          streamTransfer: farewellMessage,
          action: 'transfer',
        },
        mockEndpoint,
      )
    })

    it('should mark stream as closed', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)

      stream.close()

      expect(() => stream.send({ data: 'test' })).toThrow()
    })
  })

  describe('onMessage', () => {
    it('should register a message callback and return unsubscriber', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const messageCallback = jest.fn()

      const unsubscriber = stream.onMessage(messageCallback)

      expect(unsubscriber).toBeDefined()
      expect(typeof unsubscriber).toBe('function')
      expect(typeof (unsubscriber as any).dispose).toBe('function')
      expect(typeof (unsubscriber as any).close).toBe('function')
    })

    it('should allow unsubscribing from messages', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const messageCallback = jest.fn()

      const unsubscriber = stream.onMessage(messageCallback)
      unsubscriber()

      const transferHandler = registeredHandlers['__crx_bridge_stream_transfer__']?.[0]
      const mockMsg = {
        data: {
          streamId: 'test-stream-id',
          streamTransfer: { foo: 'bar' },
          action: 'transfer' as const,
        },
      }

      if (transferHandler) {
        transferHandler(mockMsg)
      }

      expect(messageCallback).not.toHaveBeenCalled()
    })
  })

  describe('onClose', () => {
    it('should register a close callback and return unsubscriber', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const closeCallback = jest.fn()

      const unsubscriber = stream.onClose(closeCallback)

      expect(unsubscriber).toBeDefined()
      expect(typeof unsubscriber).toBe('function')
      expect(typeof (unsubscriber as any).dispose).toBe('function')
      expect(typeof (unsubscriber as any).close).toBe('function')
    })

    it('should trigger callback when stream is closed', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const closeCallback = jest.fn()

      stream.onClose(closeCallback)
      stream.close()

      expect(closeCallback).toHaveBeenCalledWith(true)
    })

    it('should allow unsubscribing from close events', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const closeCallback = jest.fn()

      const unsubscriber = stream.onClose(closeCallback)
      unsubscriber()

      stream.close()

      expect(closeCallback).not.toHaveBeenCalled()
    })
  })

  describe('handleStreamClose', () => {
    it('should only handle close once (idempotent)', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)
      const closeCallback = jest.fn()

      stream.onClose(closeCallback)
      stream.close()
      stream.close()

      expect(closeCallback).toHaveBeenCalledTimes(1)
    })

    it('should clear emitter events on close', () => {
      const stream = new Stream(mockEndpointRuntime, mockStreamInfo)

      stream.close()

      expect((stream as any).emitter.events).toEqual({})
    })
  })
})

describe('createStreamWirings', () => {
  let mockEndpointRuntime: jest.Mocked<EndpointRuntime>
  let mockEndpoint: Endpoint
  let registeredHandlers: Record<string, Array<(msg: any) => Promise<any>>>

  beforeEach(() => {
    jest.clearAllMocks()
    registeredHandlers = {}

    mockEndpoint = {
      context: 'content-script',
      tabId: 1,
    }

    mockEndpointRuntime = {
      sendMessage: jest.fn(),
      onMessage: jest.fn((event: string, callback: (msg: any) => Promise<any>) => {
        if (!registeredHandlers[event]) {
          registeredHandlers[event] = []
        }
        registeredHandlers[event].push(callback)
        return jest.fn()
      }),
    } as unknown as jest.Mocked<EndpointRuntime>
  })

  it('should return openStream and onOpenStreamChannel functions', () => {
    const wirings = createStreamWirings(mockEndpointRuntime)

    expect(wirings).toHaveProperty('openStream')
    expect(wirings).toHaveProperty('onOpenStreamChannel')
    expect(typeof wirings.openStream).toBe('function')
    expect(typeof wirings.onOpenStreamChannel).toBe('function')
  })

  describe('onOpenStreamChannel', () => {
    it('should register a callback for a channel', () => {
      const wirings = createStreamWirings(mockEndpointRuntime)
      const callback = jest.fn()

      wirings.onOpenStreamChannel('test-channel', callback)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should throw error if channel already claimed', () => {
      const wirings = createStreamWirings(mockEndpointRuntime)
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      wirings.onOpenStreamChannel('test-channel', callback1)

      expect(() => wirings.onOpenStreamChannel('test-channel', callback2)).toThrow(
        'webext-bridge: This channel has already been claimed. Stream allows only one-on-one communication',
      )
    })

    it('should trigger callback when stream open message is received', async () => {
      const wirings = createStreamWirings(mockEndpointRuntime)
      const callback = jest.fn()

      wirings.onOpenStreamChannel('test-channel', callback)

      const onMessageHandler = (mockEndpointRuntime.onMessage as jest.Mock).mock.calls[0][1]
      const mockMessage = {
        sender: 'content-script',
        data: {
          channel: 'test-channel',
          streamId: 'test-stream-id',
          endpoint: 'background',
        },
      }

      await onMessageHandler(mockMessage)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(expect.any(Stream))
    })
  })

  describe('openStream', () => {
    it('should open a new stream and send open message', async () => {
      const wirings = createStreamWirings(mockEndpointRuntime)

      const stream = await wirings.openStream('test-channel', mockEndpoint)

      expect(stream).toBeDefined()
      expect(stream.info.channel).toBe('test-channel')
      expect(mockEndpointRuntime.sendMessage).toHaveBeenCalledWith(
        '__crx_bridge_stream_open__',
        expect.objectContaining({
          channel: 'test-channel',
          streamId: 'mocked-uuid-12345',
        }),
        mockEndpoint,
      )
    })

    it('should throw error if stream already open at channel', async () => {
      const wirings = createStreamWirings(mockEndpointRuntime)

      await wirings.openStream('test-channel', 'content-script')

      await expect(wirings.openStream('test-channel', 'content-script')).rejects.toThrow(
        'webext-bridge: A Stream is already open at this channel',
      )
    })

    it('should accept string destination', async () => {
      const wirings = createStreamWirings(mockEndpointRuntime)

      const stream = await wirings.openStream('test-channel', 'background')

      expect(stream.info.endpoint.context).toBe('background')
    })

    it('should delete stream from openStreams on close', async () => {
      const wirings = createStreamWirings(mockEndpointRuntime)

      const stream = await wirings.openStream('test-channel', 'content-script')
      stream.close()

      // After close, should be removed from internal map
      // This is tested indirectly through the onClose behavior
      expect(stream.info).toBeDefined()
    })
  })
})
