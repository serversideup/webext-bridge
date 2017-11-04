import { EventEmitter } from "events";
import { Endpoint } from "./Endpoint";
import { uuid } from "./utils";

export type OnMessageCallback = (message: IBridgeMessage) => void | any | Promise<any>;

export interface IBridgeMessage {
    sender: Endpoint;
    id: string;
    data: any;
    timestamp: number;
}

interface IInternalMessage {
    origin: string;
    destination: string;
    path: string[];
    transactionId: string;
    /**
     * Track packet's journey, as well as cache path to take given a destination/path we've been before
     */
    hops: string[];
    messageID: string;
    messageType: 'message' | 'reply';
    data: any;
    timestamp: number;
}

interface IQueuedMessage {
    resolvedNextNode: string;
    message: IInternalMessage;
}

enum RuntimeContext {
    Window,
    Frame,
    Devtools,
    Background,
    ContentScript,
    Worker,
}

const KNOWN_BASE = /((?:background$)|devtools|content-script|window)(?:@(\d+))?$/;
/**
 * Bridge
 * @external
 */
class Bridge {
    private static ctxname: string = null;
    private static id: string = null;
    private static rootContext: RuntimeContext = null;
    private static context: RuntimeContext =
    (chrome.devtools) ? RuntimeContext.Devtools
        : (chrome.tabs) ? RuntimeContext.Background
            : (chrome.extension) ? RuntimeContext.ContentScript
                : (typeof document === 'undefined' && typeof importScripts === 'function') ? RuntimeContext.Worker
                    : (typeof document !== 'undefined' && window.top !== window) ? RuntimeContext.Frame
                        : (typeof document !== 'undefined') ? RuntimeContext.Window : null;
    private static namespace: string;
    private static isExternalMessagingEnabled = false;
    private static linkedNodesCache = {};
    private static isInitialized = false;
    private static openTransactions: Map<string, any> = new Map();
    private static onMessageListeners: Map<string, OnMessageCallback> = new Map();
    private static port: chrome.runtime.Port = null;
    private static portMap: Map<string, chrome.runtime.Port> = new Map();
    private static messageQueue: Set<IQueuedMessage> = new Set();

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
    public static sendMessage(messageID: string, data: any, destination: string) {
        const frags = destination.split(':');

        const errFn = 'Bridge#sendMessage ->';
        if (frags[0].search(KNOWN_BASE) !== 0) {
            throw new TypeError(`${errFn} Destination must begin with any one of known bases`);
        }

        frags.slice(1).forEach((frag) => {
            if (frag.search(/frame$|(frame#\d+$)/) !== 0) {
                throw new TypeError(`${errFn} Destination base can only be followed by "frame#2", "frame#4" or just "frame"`);
            }
        });

        if (this.context === RuntimeContext.Background) {
            const [input, dest, destTabId] = frags[0].match(KNOWN_BASE);
            if (dest !== 'background' && !destTabId || !parseInt(destTabId, 10)) {
                throw new TypeError(`${errFn} When sending messages from background page, use @tabId syntax to target specific tab`);
            }
        }

        return new Promise((resolve, reject) => {
            const payload: IInternalMessage = {
                messageID,
                data,
                destination,
                messageType: 'message',
                path: frags,
                transactionId: uuid(),
                origin: this.ctxname,
                hops: [],
                timestamp: Date.now(),
            };
            this.openTransactions.set(payload.transactionId, resolve);
            this.routeMessage(payload);
        });
    }

    public static onMessage(messageID: string, callback: OnMessageCallback) {
        this.onMessageListeners.set(messageID, callback);
    }

    public static setNamespace = (nsps: string) => {
        Bridge.namespace = nsps;
    }

    public static enableExternalMessaging = (nsps: string) => {
        Bridge.isExternalMessagingEnabled = true;
        Bridge.namespace = nsps;
    }

    public static init() {
        if (this.isInitialized) {
            return;
        }
        if (this.context === null) {
            throw new Error(`Unable to detect runtime context i.e crx-bridge can't figure out what to do`);
        }
        this.id = uuid();
        this.ctxname = RuntimeContext[this.context].toLowerCase();
        if (this.context >= RuntimeContext.Window) {
            window.addEventListener('message', this.handleWindowOnMessage);
        }
        if (this.context === RuntimeContext.ContentScript) {
            this.ctxname = 'content-script';
            this.rootContext = RuntimeContext.ContentScript;
        }
        if (this.context === RuntimeContext.Devtools) {
            const tabId = chrome.devtools.inspectedWindow.tabId;
            const name = `devtools@${tabId}`;
            this.ctxname = name;
            this.rootContext = RuntimeContext.Devtools;
            this.port = chrome.runtime.connect({ name });
            this.port.onMessage.addListener((message: IInternalMessage) => {
                this.routeMessage(message);
            });
            this.port.onDisconnect.addListener(() => {
                this.port = null;
            });
        }
        if (this.context === RuntimeContext.Background) {
            chrome.runtime.onConnect.addListener((port) => {
                const id = port.name !== '' ? port.name : `content-script@${port.sender.tab.id}`;
                this.portMap.set(id, port);
                this.messageQueue.forEach((queuedMsg) => {
                    if (queuedMsg.resolvedNextNode === id) {
                        port.postMessage(queuedMsg.message);
                        this.messageQueue.delete(queuedMsg);
                    }
                });
                port.onDisconnect.addListener(() => {
                    this.portMap.delete(id);
                });
                port.onMessage.addListener((message: IInternalMessage) => {
                    this.routeMessage(message, { sourcePort: port });
                });
            });
        }
        if (this.context === RuntimeContext.ContentScript && top === window) {
            this.port = chrome.runtime.connect();
            this.port.onMessage.addListener((message: IInternalMessage) => {
                this.routeMessage(message);
            });
        }
        this.isInitialized = true;
    }

    private static handleWindowOnMessage = async (ev: MessageEvent) => {
        const { data, source, ports } = ev;
        if (data.cmd === '__crx_bridge_probe_root_context') {
            let type = Bridge.context;
            if (type === RuntimeContext.Frame) {
                type = await Bridge.probeRootContextType();
            }
            const port: MessagePort = ports[0];
            port.postMessage(type);
            return;
        }
        if (!Bridge.rootContext) {
            Bridge.rootContext = await Bridge.probeRootContextType();
        }
        if (Bridge.rootContext !== RuntimeContext.Devtools && data.scope !== Bridge.namespace) {
            return;
        }
        if (data.cmd === '__crx_bridge_route_message') {
            Bridge.ensureNamespace();
            Bridge.routeMessage(data.payload, { sourceWindow: source });
        }
    }

    /**
     * Used to determine whether or not namespace enforcement is required.
     * Required if root is `content-script` (a browser tab)
     * Not required if root is `devtools` (a devtools panel)
     */
    private static probeRootContextType(): Promise<RuntimeContext> {
        return new Promise((resolve, reject) => {
            if (this.context !== RuntimeContext.Frame) {
                resolve(this.context);
            } else if (window.parent !== window) {
                const channel = new MessageChannel();
                window.parent.postMessage({ cmd: '__crx_bridge_probe_root_context' }, '*', [channel.port2]);
                channel.port1.onmessage = (e) => {
                    const { data } = e;
                    if (RuntimeContext[data as number]) {
                        resolve(data as RuntimeContext);
                    }
                };
            }
        });
    }

    private static routeMessage = async (message: IInternalMessage, options: { sourceWindow?: Window, sourcePort?: chrome.runtime.Port } = {}) => {
        const { origin, path, messageID, transactionId } = message;
        if (message.hops.indexOf(Bridge.id) > -1) {
            return;
        }
        message.hops.push(Bridge.id);
        if (Bridge.context === RuntimeContext.ContentScript
            && !Bridge.isExternalMessagingEnabled
            && /window|frame/.test(message.destination + origin)) {
            return;
        }
        if (!Bridge.rootContext) {
            Bridge.rootContext = await Bridge.probeRootContextType();
        }
        if (Bridge.rootContext === RuntimeContext.Devtools) {
            Bridge.namespace = 'none';
        }
        const originNodes = origin.split(':');
        const nextNode = path[0];
        if (!nextNode) {
            Bridge.handleInboundMessage(message);
        }
        if (originNodes[0].search(KNOWN_BASE) === -1 && options.sourceWindow) {
            const frames = Array.from(document.querySelectorAll('iframe'))
                .map((frame) => frame.contentWindow);
            let idx = -1;
            frames.some((frame, i) => {
                if (frame === options.sourceWindow) {
                    idx = i;
                    return true;
                }
                return false;
            });
            if (idx > -1) {
                originNodes[0] = `frame${idx === 0 ? '' : `#{idx}`}`;
            }
            message.origin = [Bridge.ctxname, ...originNodes].join(':');
        }
        if (nextNode && nextNode.search(KNOWN_BASE) > -1) {

            if (Bridge.context === RuntimeContext.Frame) {
                Bridge.winRouteMsg(window.parent, message);
            }

            if (Bridge.context === RuntimeContext.Window) {
                Bridge.winRouteMsg(window, message);
            }

            if (Bridge.context === RuntimeContext.ContentScript && nextNode.startsWith('window')) {
                message.path.shift();
                Bridge.winRouteMsg(window, message);
            }

            if (Bridge.context === RuntimeContext.Devtools || (Bridge.context === RuntimeContext.ContentScript && !nextNode.startsWith('window'))) {
                // Just hand it over to background page
                Bridge.port.postMessage(message);
            }

            if (Bridge.context === RuntimeContext.Background && options.sourcePort) {
                const frags = origin.split(':');
                const [dest, destName, destTabId] = nextNode.match(KNOWN_BASE);
                const [src, srcName, srcTabId = `${options.sourcePort.sender.tab.id}`] = frags[0].match(KNOWN_BASE);
                if (/content-script|window/.test(srcName)) {
                    frags[0] = `${srcName}@${srcTabId}`;
                    message.origin = frags.join(':');
                }
                const fixedDest = destTabId ? dest : `${dest}@${srcTabId}`;
                if (destName !== 'window') {
                    message.path.shift();
                }
                const resolvedNextNode = destName === 'window' ? fixedDest.replace('window', 'content-script') : fixedDest;
                const port = Bridge.portMap.get(resolvedNextNode);
                if (port) {
                    port.postMessage(message);
                } else {
                    Bridge.messageQueue.add({ resolvedNextNode, message });
                }
            }
        }

        if (nextNode && nextNode.startsWith('frame')) {
            const frames = Array.from(document.querySelectorAll('iframe'))
                .map((frame) => frame.contentWindow);
            const frameIdx = parseInt(nextNode.split('#')[1] || '0', 10);
            frames.some((frame, idx) => {
                if (frameIdx === idx) {
                    message.path.shift();
                    Bridge.winRouteMsg(frame, message);
                    return true;
                }
                return false;
            });
        }
    }

    private static ensureNamespace = () => {
        if (Bridge.rootContext === RuntimeContext.Devtools) {
            return;
        }
        if (typeof Bridge.namespace !== 'string' || Bridge.namespace.length === 0) {
            const err = `crx-bridge uses window.postMessage to talk with other "window"(s) or "frame"(s), for message routing and stuff,` +
                ` which is global/conflicting operation in case there are other scripts using crx-bridge. ` +
                `Call Bridge#setNamespace(nsps) to isolate your app. Example: Bridge.setNamespace('com.facebook.react-devtools'). ` +
                `Make sure to use same namespace across all your scripts whereever window.postMessage is likely to be used`;
            throw new TypeError(err);
        }
    }

    private static async handleInboundMessage(message: IInternalMessage) {
        const { transactionId, messageID, messageType } = message;
        // Sender context
        if (messageType === 'reply' && Bridge.openTransactions.has(transactionId)) {
            const resolver = Bridge.openTransactions.get(transactionId);
            resolver(message.data);
            Bridge.openTransactions.delete(transactionId);
        } else if (messageType === 'message' && Bridge.onMessageListeners.has(messageID)) {
            const cb = Bridge.onMessageListeners.get(messageID);
            if (typeof cb === 'function') {
                const reply = await cb({
                    sender: new Endpoint(message.origin),
                    id: messageID,
                    data: message.data,
                    timestamp: message.timestamp,
                } as IBridgeMessage);

                Bridge.routeMessage({
                    ...message,
                    messageType: 'reply',
                    data: reply,
                    origin: Bridge.ctxname,
                    destination: message.origin,
                    path: message.origin.split(':'),
                    hops: [],
                });
            }
        }
    }

    private static winRouteMsg(win: Window, msg: IInternalMessage) {
        Bridge.ensureNamespace();
        win.postMessage({
            cmd: '__crx_bridge_route_message',
            scope: Bridge.namespace,
            payload: msg,
        }, '*');
    }
}
Bridge.init();
export { Bridge };
