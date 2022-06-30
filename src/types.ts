import { Jsonify, JsonValue } from 'type-fest'

export type RuntimeContext = 'devtools' | 'background' | 'popup' | 'options' | 'content-script' | 'window'

export type Endpoint = {
  context: RuntimeContext
  tabId: number
  frameId?: number
}

export interface IBridgeMessage<T extends JsonValue> {
  sender: Endpoint
  id: string
  data: T
  timestamp: number
}

export type OnMessageCallback<T, R> = (message: IBridgeMessage<T>) => R | Promise<R>

export interface IInternalMessage {
  origin: Endpoint
  destination: Endpoint
  transactionId: string
  hops: string[]
  messageID: string
  messageType: 'message' | 'reply'
  err?: JsonValue
  data?: unknown
  timestamp: number
}

export interface IQueuedMessage {
  resolvedDestination: string
  message: IInternalMessage
}

export type StreamInfo = {
  streamId: string
  channel: string
  endpoint: Endpoint
}

export type HybridUnsubscriber = {
  (): void
  dispose: () => void
  close: () => void
}

export type Destination = Endpoint | RuntimeContext | string

declare const ProtocolWithReturnSymbol: unique symbol

export interface ProtocolWithReturn<Data, Return> {
  data: Jsonify<Data>
  return: Jsonify<Return>
  /**
   * Type differentiator only.
   */
  [ProtocolWithReturnSymbol]: true
}

/**
 * Extendable by user.
 */
export interface ProtocolMap {
  __crx_bridge_stream_open__: ProtocolWithReturn<{ channel: string; streamId: string }, boolean>
  __crx_bridge_stream_transfer__: { streamId: string; action: 'transfer' | 'close'; streamTransfer: JsonValue }
  // foo: { id: number; name: string; }
  // bar: ProtocolWithReturn<string, number>
}

export type DataTypeKey = keyof ProtocolMap

type ValidateJsonValue<T> = T extends JsonValue ? T : 'This value is not a serializable JSON value'

export type GetDataType<
  K extends DataTypeKey,
> = ValidateJsonValue<ProtocolMap[K] extends ProtocolWithReturn<infer Data, any>
  ? Data
  : ProtocolMap[K]>

export type GetReturnType<
  K extends DataTypeKey,
> = ValidateJsonValue<ProtocolMap[K] extends ProtocolWithReturn<any, infer Return>
  ? Return
  : void>
