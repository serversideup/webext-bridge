import { EventEmitter } from 'events';
import { Bridge } from './Bridge';
import { Endpoint } from './Endpoint';

export interface IStreamInfo {
    streamId: string;
    channel: string;
    endpoint: Endpoint | string;
}

/**
 * Built on top of Bridge. Nothing much special except that Stream allows
 * you to create a namespaced scope under a channel name of your choice
 * and allows continuous e2e communication, with less possibility of
 * conflicting messageId's, since streams are strictly scoped.
 */
class Stream {
    private static initDone: boolean = false
    private static openStreams: Map<string, Stream> = new Map();

    private internalInfo: IStreamInfo;
    private emitter: EventEmitter;
    private isClosed: boolean;
    constructor(t: IStreamInfo) {
        if (typeof t.endpoint === 'string') {
            t.endpoint = new Endpoint(t.endpoint)
        }
        this.internalInfo = t;
        this.emitter = new EventEmitter();
        this.isClosed = false;

        if (!Stream.initDone) {
            Bridge.onMessage(`__crx_bridge_stream_transfer__`, (msg) => {
                const { streamId, streamTransfer, action } = msg.data;
                const stream = Stream.openStreams.get(streamId)
                if (stream && !stream.isClosed) {
                    if (action === 'transfer') {
                        stream.emitter.emit('message', streamTransfer);
                    }

                    if (action === 'close') {
                        Stream.openStreams.delete(streamId)
                        stream.handleStreamClose()
                    }
                }
            });
            Stream.initDone = true
        }

        Stream.openStreams.set(t.streamId, this)
    }

    /**
     * Returns stream info
     */
    public get info(): IStreamInfo {
        return this.internalInfo;
    }

    /**
     * Sends a message to other endpoint.
     * Will trigger onMessage on the other side.]
     *
     * Warning: Before sending sensitive data, verify the endpoint using `stream.info.endpoint.isInternal()`
     * The other side could be malicious webpage speaking same language as crx-bridge
     * @param msg
     */
    public send(msg: any) {
        if (this.isClosed) {
            throw new Error('Attempting to send a message over closed stream. Use stream.onClose(<callback>) to keep an eye on stream status');
        }
        Bridge.sendMessage(`__crx_bridge_stream_transfer__`, {
            streamId: this.internalInfo.streamId,
            streamTransfer: msg,
            action: 'transfer',
        }, this.internalInfo.endpoint)
    }

    /**
     * Closes the stream.
     * Will trigger stream.onClose(<callback>) on both endpoints.
     * If needed again, spawn a new Stream, as this instance cannot be re-opened
     * @param msg
     */
    public close(msg: any) {
        if (msg) {
            this.send(msg);
        }
        this.handleStreamClose();
        Bridge.sendMessage(`__crx_bridge_stream_transfer__`, {
            streamId: this.internalInfo.streamId,
            streamTransfer: null,
            action: 'close',
        }, this.internalInfo.endpoint)
    }

    /**
     * Registers a callback to fire whenever other endpoint sends a message
     * @param callback
     */
    public onMessage(callback) {
        return this.getDisposable('message', callback);
    }

    /**
     * Registers a callback to fire whenever stream.close() is called on either endpoint
     * @param callback
     */
    public onClose(callback) {
        return this.getDisposable('closed', callback);
    }

    private handleStreamClose = () => {
        if (!this.isClosed) {
            this.isClosed = true;
            this.emitter.emit('closed', true);
            this.emitter.removeAllListeners();
        }
    }

    private getDisposable(event, callback) {
        this.emitter.on(event, callback);
        const unsub = () => {
            this.emitter.removeListener(event, callback);
        };
        return Object.assign(unsub, {
            dispose: unsub,
            close: unsub,
        });
    }
}

export { Stream };
