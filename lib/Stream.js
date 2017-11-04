"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const Bridge_1 = require("./Bridge");
const Endpoint_1 = require("./Endpoint");
/**
 * Built on top of Bridge. Nothing much special except that Stream allows
 * you to create a namespaced scope under a channel name of your choice
 * and allows continuous e2e communication, with less possibility of
 * conflicting messageId's, since streams are strictly scoped.
 */
class Stream {
    constructor(t) {
        this.handleStreamTransfer = (message) => {
            this.emitter.emit('message', message.data);
        };
        this.handleStreamClose = () => {
            if (!this.isClosed) {
                this.isClosed = true;
                this.emitter.emit('closed', true);
                this.emitter.removeAllListeners();
            }
        };
        this.internalInfo = t;
        this.emitter = new events_1.EventEmitter();
        this.isClosed = false;
        const { streamId } = t;
        Bridge_1.Bridge.onMessage(`__stream_transfer__${streamId}`, this.handleStreamTransfer);
        Bridge_1.Bridge.onMessage(`__stream_close__${streamId}`, this.handleStreamClose);
    }
    /**
     * Returns stream info
     */
    get info() {
        return {
            endpoint: new Endpoint_1.Endpoint(this.internalInfo.destination),
        };
    }
    /**
     * Sends a message to other endpoint.
     * Will trigger onMessage on the other side.]
     *
     * Warning: Before sending sensitive data, verify the endpoint using `stream.info.endpoint.isInternal()`
     * The other side could be malicious webpage speaking same language as crx-bridge
     * @param msg
     */
    send(msg) {
        if (this.isClosed) {
            throw new Error('Attempting to send a message over closed stream. Use stream.onClose(<callback>) to keep an eye on stream status');
        }
        Bridge_1.Bridge.sendMessage(`__stream_transfer__${this.internalInfo.streamId}`, msg, this.internalInfo.destination);
    }
    /**
     * Closes the stream.
     * Will trigger stream.onClose(<callback>) on both endpoints.
     * If needed again, spawn a new Stream, as this instance cannot be re-opened
     * @param msg
     */
    close(msg) {
        if (msg) {
            this.send(msg);
        }
        this.handleStreamClose();
        Bridge_1.Bridge.sendMessage(`__stream_close__${this.internalInfo.streamId}`, true, this.internalInfo.destination);
    }
    /**
     * Registers a callback to fire whenever other endpoint sends a message
     * @param callback
     */
    onMessage(callback) {
        return this.getDisposable('message', callback);
    }
    /**
     * Registers a callback to fire whenever stream.close() is called on either endpoint
     * @param callback
     */
    onClose(callback) {
        return this.getDisposable('closed', callback);
    }
    getDisposable(event, callback) {
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
exports.Stream = Stream;
//# sourceMappingURL=Stream.js.map