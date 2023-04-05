import type { JsonValue, Jsonify } from 'type-fest'

export type RuntimeContext =
  | 'devtools'
  | 'background'
  | 'popup'
  | 'options'
  | 'content-script'
  | 'window'

export interface Endpoint {
  context: RuntimeContext
  tabId: number
  frameId?: number
}

export interface BridgeMessage<T extends JsonValue> {
  sender: Endpoint
  id: string
  data: T
  timestamp: number
}

export type OnMessageCallback<T extends JsonValue, R = void | JsonValue> = (
  message: BridgeMessage<T>
) => R | Promise<R>

export interface InternalMessage {
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

export interface StreamInfo {
  streamId: string
  channel: string
  endpoint: Endpoint
}

export interface HybridUnsubscriber {
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
  // foo: { id: number, name: string }
  // bar: ProtocolWithReturn<string, number>
}

export type DataTypeKey = keyof ProtocolMap extends never
  ? string
  : keyof ProtocolMap

export type GetDataType<
  K extends DataTypeKey,
  Fallback extends JsonValue = undefined,
> = K extends keyof ProtocolMap
  ? ProtocolMap[K] extends (...args: infer Args) => any
    ? Args['length'] extends 0
      ? undefined
      : Args[0]
    : ProtocolMap[K] extends ProtocolWithReturn<infer Data, any>
      ? Data
      : ProtocolMap[K]
  : Fallback;


export type GetReturnType<
  K extends DataTypeKey,
  Fallback extends JsonValue = undefined
> = K extends keyof ProtocolMap
  ? ProtocolMap[K] extends (...args: any[]) => infer R
    ? R
    : ProtocolMap[K] extends ProtocolWithReturn<any, infer Return>
      ? Return
      : void
  : Fallback;
