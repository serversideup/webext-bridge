import { EventEmitter } from "events";
import { Endpoint } from "./Endpoint";
import { uuid } from "./utils";

import * as serializeError from 'serialize-error'

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
    transactionId: string;
    hops: string[];
    messageID: string;
    messageType: 'message' | 'reply';
    err?: any;
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

const ENDPOINT_RE = /^((?:background$)|devtools|content-script|window)(?:@(\d+))?$/;

// Return true if the `chrome` object has a particular property
const hasChrome = (prop: string): boolean => (typeof chrome !== 'undefined' && chrome[prop]);

/**
 * Bridge
 * @external
 */
class Bridge {
    private static ctxname: string = null;
    private static id: string = null;
    private static context: RuntimeContext =
        hasChrome('devtools') ? RuntimeContext.Devtools
            : hasChrome('tabs') ? RuntimeContext.Background
                : hasChrome('extension') ? RuntimeContext.ContentScript
                    : (typeof document === 'undefined' && typeof importScripts === 'function') ? RuntimeContext.Worker
                        : (typeof document !== 'undefined' && window.top !== window) ? RuntimeContext.Frame
                            : (typeof document !== 'undefined') ? RuntimeContext.Window : null;
    private static namespace: string;
    private static isExternalMessagingEnabled = false;
    private static isWindowMessagingAllowed: boolean;
    private static linkedNodesCache = {};
    private static isInitialized = false;
    private static openTransactions: Map<string, { resolve: (v: any) => void; reject: (e: any) => void }> = new Map();
    private static onMessageListeners: Map<string, OnMessageCallback> = new Map();
    private static port: chrome.runtime.Port = null;
    private static portMap: Map<string, chrome.runtime.Port> = new Map();
    private static messageQueue: Set<IQueuedMessage> = new Set();

    /**
     * Sends a message to some other endpoint, to which only one listener can send response.
     * Returns Promise. Use `then` or `await` to wait for the response.
     * If destination is `window` message will routed using window.postMessage.
     * Which requires a shared namespace to be set between `content-script` and `window`
     * that way they can recognize each other when global window.postMessage happens and there are other
     * extensions using crx-bridge as well
     * @param messageID
     * @param data
     * @param destination
     */
    public static sendMessage(messageID: string, data: any, destination: string | Endpoint) {
        let endpoint: string = (destination instanceof Endpoint) ? destination.name : destination
        const errFn = 'Bridge#sendMessage ->';

        if (!ENDPOINT_RE.test(endpoint)) {
            throw new TypeError(`${errFn} Destination must be any one of known destinations`);
        }

        if (this.context === RuntimeContext.Background) {
            const [input, dest, destTabId] = endpoint.match(ENDPOINT_RE);
            if (dest !== 'background' && !destTabId || !parseInt(destTabId, 10)) {
                throw new TypeError(`${errFn} When sending messages from background page, use @tabId syntax to target specific tab`);
            }
        }

        return new Promise((resolve, reject) => {
            const payload: IInternalMessage = {
                messageID,
                data,
                destination: endpoint,
                messageType: 'message',
                transactionId: uuid(),
                origin: this.ctxname,
                hops: [],
                timestamp: Date.now(),
            };

            this.openTransactions.set(payload.transactionId, { resolve, reject });
            this.routeMessage(payload);
        });
    }

    public static onMessage(messageID: string, callback: OnMessageCallback) {
        this.onMessageListeners.set(messageID, callback);
    }

    public static setNamespace = (nsps: string) => {
        Bridge.namespace = nsps;
    }

    public static allowWindowMessaging = (nsps: string) => {
        Bridge.isWindowMessagingAllowed = true;
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

        if (this.context === RuntimeContext.Window || this.context === RuntimeContext.ContentScript) {
            window.addEventListener('message', this.handleWindowOnMessage);
        }

        if (this.context === RuntimeContext.ContentScript) {
            this.ctxname = 'content-script';
        }

        if (this.context === RuntimeContext.Devtools) {
            const tabId = chrome.devtools.inspectedWindow.tabId;
            const name = `devtools@${tabId}`;
            this.ctxname = name;

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
        if (Bridge.context === RuntimeContext.ContentScript && !Bridge.isWindowMessagingAllowed) {
            return;
        }

        const { data, source, ports } = ev;

        if (data.cmd === '__crx_bridge_verify_listening' && data.scope === Bridge.namespace && data.context !== Bridge.context) {
            const port: MessagePort = ports[0];
            port.postMessage(true);
            return;
        } else if (data.cmd === '__crx_bridge_route_message' && data.scope === Bridge.namespace && data.context !== Bridge.context) {
            // a message event insdide `content-script` means a script inside `window` dispactched it
            // so we're making sure that the origin is not tampered (i.e script is not masquerading it's true identity)
            if (Bridge.context === RuntimeContext.ContentScript) {
                data.payload.origin = 'window'
            }

            Bridge.routeMessage(data.payload)
        }
    }

    private static routeMessage = async (message: IInternalMessage, options: { sourcePort?: chrome.runtime.Port } = {}) => {
        const { origin, messageID, transactionId, destination } = message;
        if (message.hops.indexOf(Bridge.id) > -1) {
            return;
        }

        message.hops.push(Bridge.id);

        if (Bridge.context === RuntimeContext.ContentScript
            && /window/.test(message.destination + origin)
            && !Bridge.allowWindowMessaging) {
            return;
        }

        // It's previous node's job to unset destination, before handing over the payload
        if (!destination) {
            Bridge.handleInboundMessage(message);
        }

        if (ENDPOINT_RE.test(destination)) {

            if (Bridge.context === RuntimeContext.Frame) {
                throw new Error(`crx-bridge no longer supports iframes due to too much complexity and not so many use cases`)
            }

            else if (Bridge.context === RuntimeContext.Window) {
                Bridge.winRouteMsg(window, message);
            }

            else if (Bridge.context === RuntimeContext.ContentScript && destination === 'window') {
                message.destination = null
                Bridge.winRouteMsg(window, message);
            }

            else if (Bridge.context === RuntimeContext.Devtools || Bridge.context === RuntimeContext.ContentScript) {
                if (/background/.test(destination)) {
                    message.destination = null
                }
                // Just hand it over to background page
                Bridge.port.postMessage(message);
            }

            else if (Bridge.context === RuntimeContext.Background && options.sourcePort) {
                const [dest, destName, destTabId] = destination.match(ENDPOINT_RE);
                const [src, srcName, srcTabId = `${options.sourcePort.sender.tab.id}`] = origin.match(ENDPOINT_RE);
                if (/content-script|window/.test(srcName)) {
                    message.origin = `${srcName}@${srcTabId}`;
                }

                const fixedDest = destTabId ? dest : `${dest}@${srcTabId}`;
                if (destName !== 'window') {
                    message.destination = null
                } else {
                    // we're in background page, hence at this point the tab id has been resolved already, so in case it's like `window@932`
                    // we set this to just `window` because that let's content script know that this is the end of payload journey and stops
                    // it from recursive message transfers
                    message.destination = 'window'
                }

                // As far as background page is concerned, it just needs to get the payload to "actual" tab
                const resolvedNextNode = destName === 'window' ? fixedDest.replace('window', 'content-script') : fixedDest;
                const port = Bridge.portMap.get(resolvedNextNode);
                if (port) {
                    port.postMessage(message);
                } else {
                    Bridge.messageQueue.add({ resolvedNextNode, message });
                }
            }
        }
    }

    private static ensureNamespace = () => {
        if (typeof Bridge.namespace !== 'string' || Bridge.namespace.length === 0) {
            const err = `crx-bridge uses window.postMessage to talk with other "window"(s), for message routing and stuff,` +
                ` which is global/conflicting operation in case there are other scripts using crx-bridge. ` +
                `Call Bridge#setNamespace(nsps) to isolate your app. Example: Bridge.setNamespace('com.facebook.react-devtools'). ` +
                `Make sure to use same namespace across all your scripts whereever window.postMessage is likely to be used`;
            throw new Error(err);
        }
    }

    private static async handleInboundMessage(message: IInternalMessage) {
        const { transactionId, messageID, messageType } = message;
        // Sender context
        if (messageType === 'reply') {
            const transactionP = Bridge.openTransactions.get(transactionId);
            if (transactionP) {
                const { err, data } = message
                if (err) {
                    const hydratedErr = new (typeof self[err.name] === 'function' ? self[err.name] : Error)(err.message)
                    for (let prop in err) {
                        hydratedErr[prop] = err[prop]
                    }
                    transactionP.reject(hydratedErr)
                } else {
                    transactionP.resolve(data)
                }
                Bridge.openTransactions.delete(transactionId);
            }
        } else if (messageType === 'message') {
            let reply: any;
            let err
            let noHandlerFoundError = false
            try {
                const cb = Bridge.onMessageListeners.get(messageID);
                if (typeof cb === 'function') {
                    reply = await cb({
                        sender: new Endpoint(message.origin),
                        id: messageID,
                        data: message.data,
                        timestamp: message.timestamp,
                    } as IBridgeMessage);
                } else {
                    noHandlerFoundError = true
                    throw new Error(`[crx-bridge] No handler registered in '${Bridge.ctxname}' to accept messages with id '${messageID}'`)
                }
            } catch (error) {
                err = error
            } finally {

                if (err) {
                    message.err = serializeError(err)
                }

                Bridge.routeMessage({
                    ...message,
                    messageType: 'reply',
                    data: reply,
                    origin: Bridge.ctxname,
                    destination: message.origin,
                    hops: [],
                });

                if (err && !noHandlerFoundError) {
                    throw reply
                }
            }
        }
    }

    private static winRouteMsg(win: Window, msg: IInternalMessage) {
        Bridge.ensureNamespace();
        const channel = new MessageChannel();
        const retry = setTimeout(() => {
            channel.port1.onmessage = null;
            Bridge.winRouteMsg(win, msg);
        }, 300);
        channel.port1.onmessage = (ev: MessageEvent) => {
            clearTimeout(retry);
            win.postMessage({
                cmd: '__crx_bridge_route_message',
                scope: Bridge.namespace,
                payload: msg,
                context: Bridge.context,
            }, '*');
        };
        win.postMessage({ cmd: '__crx_bridge_verify_listening', scope: Bridge.namespace, context: Bridge.context }, '*', [channel.port2]);
    }
}
Bridge.init();
export { Bridge };
