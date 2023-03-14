import { JsonValue, Jsonify } from 'type-fest';

type RuntimeContext = 'devtools' | 'background' | 'popup' | 'options' | 'content-script' | 'window';
type Endpoint = {
    context: RuntimeContext;
    tabId: number;
    frameId?: number;
};
interface IBridgeMessage<T extends JsonValue> {
    sender: Endpoint;
    id: string;
    data: T;
    timestamp: number;
}
type OnMessageCallback<T extends JsonValue, R = void | JsonValue> = (message: IBridgeMessage<T>) => R | Promise<R>;
interface IInternalMessage {
    origin: Endpoint;
    destination: Endpoint;
    transactionId: string;
    hops: string[];
    messageID: string;
    messageType: 'message' | 'reply';
    err?: JsonValue;
    data?: JsonValue | void;
    timestamp: number;
}
interface IQueuedMessage {
    resolvedDestination: string;
    message: IInternalMessage;
}
type StreamInfo = {
    streamId: string;
    channel: string;
    endpoint: Endpoint;
};
type HybridUnsubscriber = {
    (): void;
    dispose: () => void;
    close: () => void;
};
type Destination = Endpoint | RuntimeContext | string;
declare const ProtocolWithReturnSymbol: unique symbol;
interface ProtocolWithReturn<Data, Return> {
    data: Jsonify<Data>;
    return: Jsonify<Return>;
    /**
     * Type differentiator only.
     */
    [ProtocolWithReturnSymbol]: true;
}
/**
 * Extendable by user.
 */
interface ProtocolMap {
}
type DataTypeKey = keyof ProtocolMap;
type GetDataType<K extends DataTypeKey | string, Fallback extends JsonValue> = K extends DataTypeKey ? ProtocolMap[K] extends ProtocolWithReturn<infer Data, any> ? Data : ProtocolMap[K] : Fallback;
type GetReturnType<K extends DataTypeKey | string, Fallback extends JsonValue> = K extends DataTypeKey ? ProtocolMap[K] extends ProtocolWithReturn<any, infer Return> ? Return : void : Fallback;

/**
 * Built on top of Bridge. Nothing much special except that Stream allows
 * you to create a namespaced scope under a channel name of your choice
 * and allows continuous e2e communication, with less possibility of
 * conflicting messageId's, since streams are strictly scoped.
 */
declare class Stream {
    private static initDone;
    private static openStreams;
    private internalInfo;
    private emitter;
    private isClosed;
    constructor(t: StreamInfo);
    /**
     * Returns stream info
     */
    get info(): StreamInfo;
    /**
     * Sends a message to other endpoint.
     * Will trigger onMessage on the other side.
     *
     * Warning: Before sending sensitive data, verify the endpoint using `stream.info.endpoint.isInternal()`
     * The other side could be malicious webpage speaking same language as webext-bridge
     * @param msg
     */
    send(msg?: JsonValue): void;
    /**
     * Closes the stream.
     * Will trigger stream.onClose(<callback>) on both endpoints.
     * If needed again, spawn a new Stream, as this instance cannot be re-opened
     * @param msg
     */
    close(msg?: JsonValue): void;
    /**
     * Registers a callback to fire whenever other endpoint sends a message
     * @param callback
     */
    onMessage<T extends JsonValue>(callback: (msg?: T) => void): HybridUnsubscriber;
    /**
     * Registers a callback to fire whenever stream.close() is called on either endpoint
     * @param callback
     */
    onClose<T extends JsonValue>(callback: (msg?: T) => void): HybridUnsubscriber;
    private handleStreamClose;
    private getDisposable;
}

declare function openStream(channel: string, destination: RuntimeContext | Endpoint | string): Promise<Stream>;
declare function onOpenStreamChannel(channel: string, callback: (stream: Stream) => void): void;

declare function setNamespace(nsps: string): void;
declare function allowWindowMessaging(nsps: string): void;
declare function getCurrentContext(): RuntimeContext;

declare const parseEndpoint: (endpoint: string) => Endpoint;
declare const isInternalEndpoint: ({ context: ctx }: Endpoint) => boolean;

declare function onMessage<Data extends JsonValue, K extends DataTypeKey | string>(messageID: K, callback: OnMessageCallback<GetDataType<K, Data>, GetReturnType<K, any>>): void;

/**
 * Sends a message to some other endpoint, to which only one listener can send response.
 * Returns Promise. Use `then` or `await` to wait for the response.
 * If destination is `window` message will routed using window.postMessage.
 * Which requires a shared namespace to be set between `content-script` and `window`
 * that way they can recognize each other when global window.postMessage happens and there are other
 * extensions using webext-bridge as well
 * @param messageID
 * @param data
 * @param destination default 'background'
 */
declare function sendMessage<ReturnType extends JsonValue, K extends DataTypeKey | string>(messageID: K, data: GetDataType<K, JsonValue>, destination?: Destination): Promise<GetReturnType<K, ReturnType>>;

export { DataTypeKey, Destination, Endpoint, GetDataType, GetReturnType, HybridUnsubscriber, IBridgeMessage, IInternalMessage, IQueuedMessage, OnMessageCallback, ProtocolMap, ProtocolWithReturn, RuntimeContext, Stream, StreamInfo, allowWindowMessaging, getCurrentContext, isInternalEndpoint, onMessage, onOpenStreamChannel, openStream, parseEndpoint, sendMessage, setNamespace };
