import { JsonValue } from 'type-fest'

export type RuntimeContext = 'devtools' | 'background' | 'content-script' | 'window'

export type Endpoint = {
  context: RuntimeContext
  tabId: number
}

export interface IBridgeMessage<T extends JsonValue> {
  sender: Endpoint
  id: string
  data: T
  timestamp: number
}

export type OnMessageCallback<T extends JsonValue> = (message: IBridgeMessage<T>) => void | JsonValue | Promise<JsonValue>

export interface IInternalMessage {
  origin: Endpoint
  destination: Endpoint
  transactionId: string
  hops: string[]
  messageID: string
  messageType: 'message' | 'reply'
  err?: JsonValue
  data?: JsonValue | void
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

export interface ProtocolWithReturn<Data extends JsonValue, Return extends JsonValue> {
  data: Data
  return: Return
  /**
   * Type differentiator only.
   */
  [ProtocolWithReturnSymbol]: true
}

/**
 * Extendable by user.
 */
export interface ProtocolMap {
  // foo: { id: number, name: string }
  // bar: ProtocolWithReturn<string, number>
}

export type DataTypeKey = keyof ProtocolMap

export type GetDataType<
  K extends DataTypeKey | string,
  Fallback extends JsonValue
> = K extends DataTypeKey
  ? ProtocolMap[K] extends ProtocolWithReturn<infer Data, any>
    ? Data
    : ProtocolMap[K]
  : Fallback

export type GetReturnType<
  K extends DataTypeKey | string,
  Fallback extends JsonValue
> = K extends DataTypeKey
  ? ProtocolMap[K] extends ProtocolWithReturn<any, infer Return>
    ? Return
    : void
  : Fallback
