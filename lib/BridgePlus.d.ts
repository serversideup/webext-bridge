import { Bridge } from "./Bridge";
import { Stream } from "./Stream";
declare class BridgePlus extends Bridge {
    private static openStreams;
    private static onOpenStreamCallbacks;
    private static streamyEmitter;
    /**
     * @external
     */
    static init(): void;
    static onOpenStreamChannel(channel: string, callback: (stream: Stream) => void): void;
    static openStream(channel: string, destination: string): Promise<Stream>;
}
export { BridgePlus };
