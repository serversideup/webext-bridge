"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const Bridge_1 = require("./Bridge");
const Stream_1 = require("./Stream");
const utils_1 = require("./utils");
class BridgePlus extends Bridge_1.Bridge {
    /**
     * @external
     */
    static init() {
        super.init();
        this.onMessage('__stream_opened', (message) => {
            return new Promise((resolve) => {
                const { sender, data } = message;
                const { channel } = data;
                let watching = false;
                const readyup = () => {
                    const callback = this.onOpenStreamCallbacks.get(channel);
                    if (typeof callback === 'function') {
                        callback(new Stream_1.Stream(Object.assign({}, data, { destination: sender.path })));
                        if (watching) {
                            this.streamyEmitter.removeListener('did-change-stream-callbacks', readyup);
                        }
                        resolve(true);
                    }
                    else if (!watching) {
                        watching = true;
                        this.streamyEmitter.on('did-change-stream-callbacks', readyup);
                    }
                };
                readyup();
            });
        });
    }
    static onOpenStreamChannel(channel, callback) {
        if (this.onOpenStreamCallbacks.has(channel)) {
            throw new Error(`crx-bridge: This channel has already been claimed. Stream allows only one-on-one communication`);
        }
        this.onOpenStreamCallbacks.set(channel, callback);
        this.streamyEmitter.emit('did-change-stream-callbacks');
    }
    static openStream(channel, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.openStreams.has(channel)) {
                throw new Error(`crx-bridge: A Stream is already open at this channel`);
            }
            const streamInfo = {
                streamId: utils_1.uuid(),
                channel,
                destination,
            };
            const stream = new Stream_1.Stream(streamInfo);
            stream.onClose(() => {
                this.openStreams.delete(channel);
            });
            yield this.sendMessage('__stream_opened', streamInfo, destination);
            this.openStreams.set(channel, stream);
            return stream;
        });
    }
}
BridgePlus.openStreams = new Map();
BridgePlus.onOpenStreamCallbacks = new Map();
BridgePlus.streamyEmitter = new events_1.EventEmitter();
exports.BridgePlus = BridgePlus;
BridgePlus.init();
//# sourceMappingURL=BridgePlus.js.map