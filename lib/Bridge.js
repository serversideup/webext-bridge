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
const Endpoint_1 = require("./Endpoint");
const utils_1 = require("./utils");
var RuntimeContext;
(function (RuntimeContext) {
    RuntimeContext[RuntimeContext["Window"] = 0] = "Window";
    RuntimeContext[RuntimeContext["Frame"] = 1] = "Frame";
    RuntimeContext[RuntimeContext["Devtools"] = 2] = "Devtools";
    RuntimeContext[RuntimeContext["Background"] = 3] = "Background";
    RuntimeContext[RuntimeContext["ContentScript"] = 4] = "ContentScript";
    RuntimeContext[RuntimeContext["Worker"] = 5] = "Worker";
})(RuntimeContext || (RuntimeContext = {}));
const KNOWN_BASE = /((?:background$)|devtools|content-script|window)(?:@(\d+))?$/;
/**
 * Bridge
 * @external
 */
class Bridge {
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
    static sendMessage(messageID, data, destination) {
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
            const payload = {
                messageID,
                data,
                destination,
                messageType: 'message',
                path: frags,
                transactionId: utils_1.uuid(),
                origin: this.ctxname,
                hops: [],
                timestamp: Date.now(),
            };
            this.openTransactions.set(payload.transactionId, resolve);
            this.routeMessage(payload);
        });
    }
    static onMessage(messageID, callback) {
        this.onMessageListeners.set(messageID, callback);
    }
    static init() {
        if (this.isInitialized) {
            return;
        }
        if (this.context === null) {
            throw new Error(`Unable to detect runtime context i.e crx-bridge can't figure out what to do`);
        }
        this.id = utils_1.uuid();
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
            this.port.onMessage.addListener((message) => {
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
                port.onMessage.addListener((message) => {
                    this.routeMessage(message, { sourcePort: port });
                });
            });
        }
        if (this.context === RuntimeContext.ContentScript && top === window) {
            this.port = chrome.runtime.connect();
            this.port.onMessage.addListener((message) => {
                this.routeMessage(message);
            });
        }
        this.isInitialized = true;
    }
    /**
     * Used to determine whether or not namespace enforcement is required.
     * Required if root is `content-script` (a browser tab)
     * Not required if root is `devtools` (a devtools panel)
     */
    static probeRootContextType() {
        return new Promise((resolve, reject) => {
            if (this.context !== RuntimeContext.Frame) {
                resolve(this.context);
            }
            else if (window.parent !== window) {
                const channel = new MessageChannel();
                window.parent.postMessage({ cmd: '__crx_bridge_probe_root_context' }, '*', [channel.port2]);
                channel.port1.onmessage = (e) => {
                    const { data } = e;
                    if (RuntimeContext[data]) {
                        resolve(data);
                    }
                };
            }
        });
    }
    static handleInboundMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            const { transactionId, messageID, messageType } = message;
            // Sender context
            if (messageType === 'reply' && Bridge.openTransactions.has(transactionId)) {
                const resolver = Bridge.openTransactions.get(transactionId);
                resolver(message.data);
                Bridge.openTransactions.delete(transactionId);
            }
            else if (messageType === 'message' && Bridge.onMessageListeners.has(messageID)) {
                const cb = Bridge.onMessageListeners.get(messageID);
                if (typeof cb === 'function') {
                    const reply = yield cb({
                        sender: new Endpoint_1.Endpoint(message.origin),
                        id: messageID,
                        data: message.data,
                        timestamp: message.timestamp,
                    });
                    Bridge.routeMessage(Object.assign({}, message, { messageType: 'reply', data: reply, origin: Bridge.ctxname, destination: message.origin, path: message.origin.split(':'), hops: [] }));
                }
            }
        });
    }
    static winRouteMsg(win, msg) {
        Bridge.ensureNamespace();
        const channel = new MessageChannel();
        const retry = setTimeout(() => {
            channel.port1.onmessage = null;
            Bridge.winRouteMsg(win, msg);
        }, 300);
        channel.port1.onmessage = (ev) => {
            clearTimeout(retry);
            win.postMessage({
                cmd: '__crx_bridge_route_message',
                scope: Bridge.namespace,
                payload: msg,
            }, '*');
        };
        win.postMessage({ cmd: '__crx_bridge_verify_listening', scope: Bridge.namespace }, '*', [channel.port2]);
    }
}
Bridge.ctxname = null;
Bridge.id = null;
Bridge.rootContext = null;
Bridge.context = (chrome.devtools) ? RuntimeContext.Devtools
    : (chrome.tabs) ? RuntimeContext.Background
        : (chrome.extension) ? RuntimeContext.ContentScript
            : (typeof document === 'undefined' && typeof importScripts === 'function') ? RuntimeContext.Worker
                : (typeof document !== 'undefined' && window.top !== window) ? RuntimeContext.Frame
                    : (typeof document !== 'undefined') ? RuntimeContext.Window : null;
Bridge.isExternalMessagingEnabled = false;
Bridge.linkedNodesCache = {};
Bridge.isInitialized = false;
Bridge.openTransactions = new Map();
Bridge.onMessageListeners = new Map();
Bridge.port = null;
Bridge.portMap = new Map();
Bridge.messageQueue = new Set();
Bridge.setNamespace = (nsps) => {
    Bridge.namespace = nsps;
};
Bridge.enableExternalMessaging = (nsps) => {
    console.warn('External messaging is now deprecated due to added complexity and not so many use cases, use `allowWindowMessaging(nsps: string)` instead');
    Bridge.isExternalMessagingEnabled = true;
    Bridge.namespace = nsps;
};
Bridge.allowWindowMessaging = (nsps) => {
    Bridge.isWindowMessagingAllowed = true;
    Bridge.namespace = nsps;
};
Bridge.handleWindowOnMessage = (ev) => __awaiter(this, void 0, void 0, function* () {
    const { data, source, ports } = ev;
    if (data.cmd === '__crx_bridge_probe_root_context') {
        let type = Bridge.context;
        if (type === RuntimeContext.Frame) {
            type = yield Bridge.probeRootContextType();
        }
        const port = ports[0];
        port.postMessage(type);
        return;
    }
    if (data.cmd === '__crx_bridge_verify_listening' && data.scope === Bridge.namespace) {
        const port = ports[0];
        port.postMessage(true);
        return;
    }
    if (!Bridge.rootContext) {
        Bridge.rootContext = yield Bridge.probeRootContextType();
    }
    if (Bridge.rootContext !== RuntimeContext.Devtools && data.scope !== Bridge.namespace) {
        return;
    }
    if (data.cmd === '__crx_bridge_route_message') {
        Bridge.ensureNamespace();
        Bridge.routeMessage(data.payload, { sourceWindow: source });
    }
});
Bridge.routeMessage = (message, options = {}) => __awaiter(this, void 0, void 0, function* () {
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
        Bridge.rootContext = yield Bridge.probeRootContextType();
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
            }
            else {
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
});
Bridge.ensureNamespace = () => {
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
};
exports.Bridge = Bridge;
Bridge.init();
//# sourceMappingURL=Bridge.js.map