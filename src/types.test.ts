import type {
  RuntimeContext,
  Endpoint,
  BridgeMessage,
  OnMessageCallback,
  InternalMessage,
  StreamInfo,
  HybridUnsubscriber,
  Destination,
  ProtocolWithReturn,
  ProtocolMap,
  DataTypeKey,
  GetDataType,
  GetReturnType,
} from './types'

describe('types', () => {
  describe('RuntimeContext', () => {
    it('should accept valid runtime contexts', () => {
      const contexts: RuntimeContext[] = [
        'devtools',
        'background',
        'popup',
        'options',
        'content-script',
        'window',
      ]
      expect(contexts).toHaveLength(6)
    })
  })

  describe('Endpoint', () => {
    it('should create endpoint with required fields', () => {
      const endpoint: Endpoint = {
        context: 'background',
        tabId: 1,
      }
      expect(endpoint.context).toBe('background')
      expect(endpoint.tabId).toBe(1)
    })

    it('should create endpoint with optional frameId', () => {
      const endpoint: Endpoint = {
        context: 'content-script',
        tabId: 2,
        frameId: 3,
      }
      expect(endpoint.frameId).toBe(3)
    })
  })

  describe('BridgeMessage', () => {
    it('should create bridge message with all fields', () => {
      const message: BridgeMessage<{ key: string }> = {
        sender: { context: 'popup', tabId: 1 },
        id: 'msg-123',
        data: { key: 'value' },
        timestamp: Date.now(),
      }
      expect(message.id).toBe('msg-123')
      expect(message.data.key).toBe('value')
    })
  })

  describe('OnMessageCallback', () => {
    it('should define callback that returns void', async () => {
      const callback: OnMessageCallback<{ val: number }, void> = (message) => {
        expect(message.data.val).toBeDefined()
      }
      const result = callback({
        sender: { context: 'window', tabId: 1 },
        id: 'test',
        data: { val: 42 },
        timestamp: Date.now(),
      })
      expect(result).toBeUndefined()
    })

    it('should define callback that returns value', async () => {
      const callback: OnMessageCallback<string, number> = (message) => {
        return message.data.length
      }
      const result = callback({
        sender: { context: 'devtools', tabId: 1 },
        id: 'test',
        data: 'hello',
        timestamp: Date.now(),
      })
      expect(result).toBe(5)
    })

    it('should define async callback', async () => {
      const callback: OnMessageCallback<number, string> = async (message) => {
        return `received: ${message.data}`
      }
      const result = await callback({
        sender: { context: 'options', tabId: 1 },
        id: 'test',
        data: 123,
        timestamp: Date.now(),
      })
      expect(result).toBe('received: 123')
    })
  })

  describe('InternalMessage', () => {
    it('should create internal message with message type', () => {
      const msg: InternalMessage = {
        origin: { context: 'background', tabId: 1 },
        destination: { context: 'popup', tabId: 2 },
        transactionId: 'txn-1',
        hops: ['hop1', 'hop2'],
        messageID: 'msg-1',
        messageType: 'message',
        data: { payload: 'test' },
        timestamp: Date.now(),
      }
      expect(msg.messageType).toBe('message')
      expect(msg.hops).toHaveLength(2)
    })

    it('should create internal message with reply type', () => {
      const msg: InternalMessage = {
        origin: { context: 'popup', tabId: 2 },
        destination: { context: 'background', tabId: 1 },
        transactionId: 'txn-1',
        hops: ['hop1'],
        messageID: 'msg-1',
        messageType: 'reply',
        data: { result: 'ok' },
        timestamp: Date.now(),
      }
      expect(msg.messageType).toBe('reply')
    })

    it('should create internal message with error', () => {
      const msg: InternalMessage = {
        origin: { context: 'content-script', tabId: 1 },
        destination: { context: 'background', tabId: 1 },
        transactionId: 'txn-2',
        hops: [],
        messageID: 'msg-2',
        messageType: 'reply',
        err: { message: 'Something went wrong' },
        timestamp: Date.now(),
      }
      expect(msg.err).toBeDefined()
      expect((msg.err as { message: string }).message).toBe('Something went wrong')
    })
  })

  describe('StreamInfo', () => {
    it('should create stream info', () => {
      const stream: StreamInfo = {
        streamId: 'stream-123',
        channel: 'notifications',
        endpoint: { context: 'background', tabId: 1 },
      }
      expect(stream.streamId).toBe('stream-123')
      expect(stream.channel).toBe('notifications')
    })
  })

  describe('HybridUnsubscriber', () => {
    it('should create hybrid unsubscriber with call and methods', () => {
      let disposed = false
      const unsubscriber: HybridUnsubscriber = Object.assign(
        () => {
          disposed = true
        },
        {
          dispose: () => {
            disposed = true
          },
          close: () => {
            disposed = true
          },
        }
      )
      unsubscriber()
      expect(disposed).toBe(true)

      disposed = false
      unsubscriber.dispose()
      expect(disposed).toBe(true)

      disposed = false
      unsubscriber.close()
      expect(disposed).toBe(true)
    })
  })

  describe('Destination', () => {
    it('should accept endpoint as destination', () => {
      const dest: Destination = { context: 'background', tabId: 1 }
      expect(dest).toEqual({ context: 'background', tabId: 1 })
    })

    it('should accept runtime context as destination', () => {
      const dest: Destination = 'popup'
      expect(dest).toBe('popup')
    })

    it('should accept string as destination', () => {
      const dest: Destination = 'custom-destination'
      expect(dest).toBe('custom-destination')
    })
  })

  describe('ProtocolWithReturn', () => {
    it('should create protocol with return type', () => {
      const protocol = {
        data: { input: 'test' },
        return: { output: 42 },
      } as ProtocolWithReturn<{ input: string }, { output: number }>
      expect(protocol.data.input).toBe('test')
      expect((protocol.return as { output: number }).output).toBe(42)
    })
  })

  describe('ProtocolMap', () => {
    it('should allow extending protocol map', () => {
      // This test verifies that ProtocolMap can be extended
      // by declaring a custom interface that merges with it
      interface CustomProtocolMap extends ProtocolMap {
        customEvent: { value: string }
      }
      const map: CustomProtocolMap = {
        customEvent: { value: 'test' },
      }
      expect(map.customEvent.value).toBe('test')
    })
  })

  describe('DataTypeKey', () => {
    it('should be string when ProtocolMap is empty', () => {
      // DataTypeKey defaults to string when ProtocolMap has no keys
      const key: DataTypeKey = 'any-key'
      expect(key).toBe('any-key')
    })
  })

  describe('GetDataType', () => {
    it('should return fallback for unknown key', () => {
      type Result = GetDataType<'unknown', string>
      const value: Result = undefined as Result
      expect(value).toBeUndefined()
    })
  })

  describe('GetReturnType', () => {
    it('should return fallback for unknown key', () => {
      type Result = GetReturnType<'unknown', string>
      const value: Result = undefined as Result
      expect(value).toBeUndefined()
    })
  })
})
