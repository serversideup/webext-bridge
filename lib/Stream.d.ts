import { Endpoint } from './Endpoint';
export interface IStreamAttributes {
    streamId: string;
    channel: string;
    destination: string;
}
export interface IStreamInfo {
    endpoint: Endpoint;
}
/**
 * Built on top of Bridge. Nothing much special except that Stream allows
 * you to create a namespaced scope under a channel name of your choice
 * and allows continuous e2e communication, with less possibility of
 * conflicting messageId's, since streams are strictly scoped.
 */
declare class Stream {
    private internalInfo;
    private emitter;
    private isClosed;
    constructor(t: IStreamAttributes);
    /**
     * Returns stream info
     */
    readonly info: IStreamInfo;
    /**
     * Sends a message to other endpoint.
     * Will trigger onMessage on the other side.]
     *
     * Warning: Before sending sensitive data, verify the endpoint using `stream.info.endpoint.isInternal()`
     * The other side could be malicious webpage speaking same language as crx-bridge
     * @param msg
     */
    send(msg: any): void;
    /**
     * Closes the stream.
     * Will trigger stream.onClose(<callback>) on both endpoints.
     * If needed again, spawn a new Stream, as this instance cannot be re-opened
     * @param msg
     */
    close(msg: any): void;
    /**
     * Registers a callback to fire whenever other endpoint sends a message
     * @param callback
     */
    onMessage(callback: any): (() => void) & {
        dispose: () => void;
        close: () => void;
    };
    /**
     * Registers a callback to fire whenever stream.close() is called on either endpoint
     * @param callback
     */
    onClose(callback: any): (() => void) & {
        dispose: () => void;
        close: () => void;
    };
    private handleStreamTransfer;
    private handleStreamClose;
    private getDisposable(event, callback);
}
export { Stream };
