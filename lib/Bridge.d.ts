import { Endpoint } from "./Endpoint";
export declare type OnMessageCallback = (message: IBridgeMessage) => void | any | Promise<any>;
export interface IBridgeMessage {
    sender: Endpoint;
    id: string;
    data: any;
    timestamp: number;
}
/**
 * Bridge
 * @external
 */
declare class Bridge {
    private static ctxname;
    private static id;
    private static rootContext;
    private static context;
    private static namespace;
    private static isExternalMessagingEnabled;
    private static isWindowMessagingAllowed;
    private static linkedNodesCache;
    private static isInitialized;
    private static openTransactions;
    private static onMessageListeners;
    private static port;
    private static portMap;
    private static messageQueue;
    /**
     * Sends a message to some other endpoint, to which only one listener can send response.
     * Returns Promise. Use `then` or `await` to wait for the response.
     * If destination is `window` or `frame` message will routed using window.postMessage.
     * Which requires a shared namespace to be set between parent contexts and children `window`/`frame`(s)
     * so they can recognize each other when global window.postMessage happens and there are other
     * extensions using crx-bridge as well
     * @param messageID
     * @param data
     * @param destination
     */
    static sendMessage(messageID: string, data: any, destination: string): Promise<{}>;
    static onMessage(messageID: string, callback: OnMessageCallback): void;
    static setNamespace: (nsps: string) => void;
    static enableExternalMessaging: (nsps: string) => void;
    static allowWindowMessaging: (nsps: string) => void;
    static init(): void;
    private static handleWindowOnMessage;
    /**
     * Used to determine whether or not namespace enforcement is required.
     * Required if root is `content-script` (a browser tab)
     * Not required if root is `devtools` (a devtools panel)
     */
    private static probeRootContextType();
    private static routeMessage;
    private static ensureNamespace;
    private static handleInboundMessage(message);
    private static winRouteMsg(win, msg);
}
export { Bridge };
