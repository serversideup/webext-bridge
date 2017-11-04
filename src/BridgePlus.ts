import { EventEmitter } from 'events';
import { Bridge } from "./Bridge";
import { Stream } from "./Stream";
import { uuid } from "./utils";

class BridgePlus extends Bridge {

    private static openStreams: any = new Map();
    private static onOpenStreamCallbacks: any = new Map();
    private static streamyEmitter: EventEmitter = new EventEmitter();
    /**
     * @external
     */
    public static init() {
        super.init();
        this.onMessage('__stream_opened', (message) => {
            return new Promise((resolve) => {
                const { sender, data } = message;
                const { channel } = data;
                let watching = false;
                const readyup = () => {
                    const callback = this.onOpenStreamCallbacks.get(channel);
                    if (typeof callback === 'function') {
                        callback(new Stream({ ...data, destination: sender.path }));
                        if (watching) {
                            this.streamyEmitter.removeListener('did-change-stream-callbacks', readyup);
                        }
                        resolve(true);
                    } else if (!watching) {
                        watching = true;
                        this.streamyEmitter.on('did-change-stream-callbacks', readyup);
                    }
                };
                readyup();
            });
        });
    }

    public static onOpenStreamChannel(channel: string, callback: (stream: Stream) => void) {
        if (this.onOpenStreamCallbacks.has(channel)) {
            throw new Error(`crx-bridge: This channel has already been claimed. Stream allows only one-on-one communication`);
        }
        this.onOpenStreamCallbacks.set(channel, callback);
        this.streamyEmitter.emit('did-change-stream-callbacks');
    }

    public static async openStream(channel: string, destination: string) {
        if (this.openStreams.has(channel)) {
            throw new Error(`crx-bridge: A Stream is already open at this channel`);
        }
        const streamInfo = {
            streamId: uuid(),
            channel,
            destination,
        };

        const stream = new Stream(streamInfo);
        stream.onClose(() => {
            this.openStreams.delete(channel);
        });
        await this.sendMessage('__stream_opened', streamInfo, destination);
        this.openStreams.set(channel, stream);
        return stream;
    }
}

BridgePlus.init();

export { BridgePlus };
