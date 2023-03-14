var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Stream: () => Stream,
  allowWindowMessaging: () => allowWindowMessaging,
  getCurrentContext: () => getCurrentContext,
  isInternalEndpoint: () => isInternalEndpoint,
  onMessage: () => onMessage,
  onOpenStreamChannel: () => onOpenStreamChannel,
  openStream: () => openStream,
  parseEndpoint: () => parseEndpoint,
  sendMessage: () => sendMessage,
  setNamespace: () => setNamespace
});
module.exports = __toCommonJS(src_exports);

// src/stream.ts
var import_nanoevents = require("nanoevents");

// src/internal.ts
var import_webextension_polyfill2 = __toESM(require("webextension-polyfill"));
var import_serialize_error = require("serialize-error");
var import_tiny_uid = __toESM(require("tiny-uid"));

// src/utils.ts
var import_webextension_polyfill = __toESM(require("webextension-polyfill"));
var ENDPOINT_RE = /^((?:background$)|devtools|popup|options|content-script|window)(?:@(\d+)(?:\.(\d+))?)?$/;
var parseEndpoint = (endpoint) => {
  const [, context2, tabId, frameId] = endpoint.match(ENDPOINT_RE) || [];
  return {
    context: context2,
    tabId: +tabId,
    frameId: frameId ? +frameId : void 0
  };
};
var isInternalEndpoint = ({ context: ctx }) => ["content-script", "background", "devtools"].includes(ctx);
var hasAPI = (nsps) => import_webextension_polyfill.default[nsps];
var getBackgroundPageType = () => {
  var _a, _b, _c, _d;
  const manifest = import_webextension_polyfill.default.runtime.getManifest();
  if (typeof window === "undefined")
    return "background";
  const popupPage = ((_a = manifest.browser_action) == null ? void 0 : _a.default_popup) || ((_b = manifest.action) == null ? void 0 : _b.default_popup);
  if (popupPage) {
    const url = new URL(import_webextension_polyfill.default.runtime.getURL(popupPage));
    if (url.pathname === window.location.pathname)
      return "popup";
  }
  if ((_c = manifest.options_ui) == null ? void 0 : _c.page) {
    const url = new URL(import_webextension_polyfill.default.runtime.getURL(manifest.options_ui.page));
    if (url.pathname === window.location.pathname)
      return "options";
  }
  if ((_d = manifest.chrome_url_overrides) == null ? void 0 : _d.newtab) {
    const url = new URL(import_webextension_polyfill.default.runtime.getURL(manifest.chrome_url_overrides.newtab));
    if (url.pathname === window.location.pathname)
      return "options";
  }
  return "background";
};

// src/internal.ts
var context = hasAPI("devtools") ? "devtools" : hasAPI("tabs") ? getBackgroundPageType() : hasAPI("extension") ? "content-script" : typeof document !== "undefined" ? "window" : null;
var runtimeId = (0, import_tiny_uid.default)();
var openTransactions = /* @__PURE__ */ new Map();
var onMessageListeners = /* @__PURE__ */ new Map();
var messageQueue = /* @__PURE__ */ new Set();
var portMap = /* @__PURE__ */ new Map();
var port = null;
var namespace;
var isWindowMessagingAllowed;
initIntercoms();
function setNamespace(nsps) {
  namespace = nsps;
}
function allowWindowMessaging(nsps) {
  isWindowMessagingAllowed = true;
  namespace = nsps;
}
function initIntercoms() {
  if (context === null)
    throw new Error("Unable to detect runtime context i.e webext-bridge can't figure out what to do");
  if (context === "window" || context === "content-script")
    window.addEventListener("message", handleWindowOnMessage);
  if (context === "content-script" && top === window) {
    port = import_webextension_polyfill2.default.runtime.connect();
    port.onMessage.addListener((message) => {
      routeMessage(message);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      initIntercoms();
    });
  }
  if (context === "content-script" && top !== window) {
    port = import_webextension_polyfill2.default.runtime.connect();
    port.onMessage.addListener((message) => {
      routeMessage(message);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      initIntercoms();
    });
  }
  if (context === "devtools") {
    const { tabId } = import_webextension_polyfill2.default.devtools.inspectedWindow;
    const name = `devtools@${tabId}`;
    port = import_webextension_polyfill2.default.runtime.connect(void 0, { name });
    port.onMessage.addListener((message) => {
      routeMessage(message);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      initIntercoms();
    });
  }
  if (context === "popup" || context === "options") {
    const name = `${context}`;
    port = import_webextension_polyfill2.default.runtime.connect(void 0, { name });
    port.onMessage.addListener((message) => {
      routeMessage(message);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      initIntercoms();
    });
  }
  if (context === "background") {
    import_webextension_polyfill2.default.runtime.onConnect.addListener((incomingPort) => {
      let portId = incomingPort.name || `content-script@${incomingPort.sender.tab.id}`;
      const portFrame = incomingPort.sender.frameId;
      if (portFrame)
        portId = `${portId}.${portFrame}`;
      const { context: context2, tabId: linkedTabId, frameId: linkedFrameId } = parseEndpoint(portId);
      if (!linkedTabId && context2 !== "popup" && context2 !== "options")
        return;
      portMap.set(portId, incomingPort);
      messageQueue.forEach((queuedMsg) => {
        if (queuedMsg.resolvedDestination === portId) {
          incomingPort.postMessage(queuedMsg.message);
          messageQueue.delete(queuedMsg);
        }
      });
      incomingPort.onDisconnect.addListener(() => {
        portMap.delete(portId);
      });
      incomingPort.onMessage.addListener((message) => {
        var _a;
        if ((_a = message == null ? void 0 : message.origin) == null ? void 0 : _a.context) {
          message.origin.tabId = linkedTabId;
          message.origin.frameId = linkedFrameId;
          routeMessage(message);
        }
      });
    });
  }
}
function routeMessage(message) {
  const { origin, destination } = message;
  if (message.hops.includes(runtimeId))
    return;
  message.hops.push(runtimeId);
  if (context === "content-script" && [destination, origin].some((endpoint) => (endpoint == null ? void 0 : endpoint.context) === "window") && !isWindowMessagingAllowed)
    return;
  if (!destination)
    return handleInboundMessage(message);
  if (destination.context) {
    if (context === "window") {
      return routeMessageThroughWindow(window, message);
    } else if (context === "content-script" && destination.context === "window") {
      message.destination = null;
      return routeMessageThroughWindow(window, message);
    } else if (["devtools", "content-script", "popup", "options"].includes(context)) {
      if (destination.context === "background")
        message.destination = null;
      return port.postMessage(message);
    } else if (context === "background") {
      const { context: destName, tabId: destTabId, frameId: destFrameId } = destination;
      const { tabId: srcTabId } = origin;
      if (destName !== "window") {
        message.destination = null;
      } else {
        message.destination.tabId = null;
      }
      let resolvedDestination = ["popup", "options"].includes(destName) ? destName : `${destName === "window" ? "content-script" : destName}@${destTabId || srcTabId}`;
      if (destFrameId)
        resolvedDestination = `${resolvedDestination}.${destFrameId}`;
      const destPort = portMap.get(resolvedDestination);
      if (destPort)
        destPort.postMessage(message);
      else
        messageQueue.add({ resolvedDestination, message });
    }
  }
}
async function handleInboundMessage(message) {
  const { transactionId, messageID, messageType } = message;
  const handleReply = () => {
    const transactionP = openTransactions.get(transactionId);
    if (transactionP) {
      const { err, data } = message;
      if (err) {
        const dehydratedErr = err;
        const errCtr = self[dehydratedErr.name];
        const hydratedErr = new (typeof errCtr === "function" ? errCtr : Error)(dehydratedErr.message);
        for (const prop in dehydratedErr)
          hydratedErr[prop] = dehydratedErr[prop];
        transactionP.reject(hydratedErr);
      } else {
        transactionP.resolve(data);
      }
      openTransactions.delete(transactionId);
    }
  };
  const handleNewMessage = async () => {
    let reply;
    let err;
    let noHandlerFoundError = false;
    try {
      const cb = onMessageListeners.get(messageID);
      if (typeof cb === "function") {
        reply = await cb({
          sender: message.origin,
          id: messageID,
          data: message.data,
          timestamp: message.timestamp
        });
      } else {
        noHandlerFoundError = true;
        throw new Error(`[webext-bridge] No handler registered in '${context}' to accept messages with id '${messageID}'`);
      }
    } catch (error) {
      err = error;
    } finally {
      if (err)
        message.err = (0, import_serialize_error.serializeError)(err);
      routeMessage({
        ...message,
        messageType: "reply",
        data: reply,
        origin: { context, tabId: null },
        destination: message.origin,
        hops: []
      });
      if (err && !noHandlerFoundError)
        throw reply;
    }
  };
  switch (messageType) {
    case "reply":
      return handleReply();
    case "message":
      return handleNewMessage();
  }
}
function assertInternalMessage(msg) {
}
async function handleWindowOnMessage({ data, ports }) {
  if (context === "content-script" && !isWindowMessagingAllowed)
    return;
  if (data.cmd === "__crx_bridge_verify_listening" && data.scope === namespace && data.context !== context) {
    const msgPort = ports[0];
    msgPort.postMessage(true);
  } else if (data.cmd === "__crx_bridge_route_message" && data.scope === namespace && data.context !== context) {
    const { payload } = data;
    assertInternalMessage(payload);
    if (context === "content-script") {
      payload.origin = {
        context: "window",
        tabId: null
      };
    }
    routeMessage(payload);
  }
}
function routeMessageThroughWindow(win, msg) {
  ensureNamespaceSet();
  const channel = new MessageChannel();
  const retry = setTimeout(() => {
    channel.port1.onmessage = null;
    routeMessageThroughWindow(win, msg);
  }, 300);
  channel.port1.onmessage = () => {
    clearTimeout(retry);
    win.postMessage({
      cmd: "__crx_bridge_route_message",
      scope: namespace,
      context,
      payload: msg
    }, "*");
  };
  win.postMessage({
    cmd: "__crx_bridge_verify_listening",
    scope: namespace,
    context
  }, "*", [channel.port2]);
}
function ensureNamespaceSet() {
  if (typeof namespace !== "string" || namespace.length === 0) {
    throw new Error(
      `webext-bridge uses window.postMessage to talk with other "window"(s), for message routing and stuff,which is global/conflicting operation in case there are other scripts using webext-bridge. Call Bridge#setNamespace(nsps) to isolate your app. Example: setNamespace('com.facebook.react-devtools'). Make sure to use same namespace across all your scripts whereever window.postMessage is likely to be used\``
    );
  }
}
function getCurrentContext() {
  return context;
}

// src/apis/onMessage.ts
function onMessage(messageID, callback) {
  onMessageListeners.set(messageID, callback);
}

// src/apis/sendMessage.ts
var import_tiny_uid2 = __toESM(require("tiny-uid"));
async function sendMessage(messageID, data, destination = "background") {
  const endpoint = typeof destination === "string" ? parseEndpoint(destination) : destination;
  const errFn = "Bridge#sendMessage ->";
  if (!endpoint.context)
    throw new TypeError(`${errFn} Destination must be any one of known destinations`);
  if (context === "background") {
    const { context: dest, tabId: destTabId } = endpoint;
    if (dest !== "background" && !destTabId)
      throw new TypeError(`${errFn} When sending messages from background page, use @tabId syntax to target specific tab`);
  }
  return new Promise((resolve, reject) => {
    const payload = {
      messageID,
      data,
      destination: endpoint,
      messageType: "message",
      transactionId: (0, import_tiny_uid2.default)(),
      origin: { context, tabId: null },
      hops: [],
      timestamp: Date.now()
    };
    openTransactions.set(payload.transactionId, { resolve, reject });
    routeMessage(payload);
  });
}

// src/stream.ts
var _Stream = class {
  constructor(t) {
    this.handleStreamClose = () => {
      if (!this.isClosed) {
        this.isClosed = true;
        this.emitter.emit("closed", true);
        this.emitter.events = {};
      }
    };
    this.internalInfo = t;
    this.emitter = (0, import_nanoevents.createNanoEvents)();
    this.isClosed = false;
    if (!_Stream.initDone) {
      onMessage("__crx_bridge_stream_transfer__", (msg) => {
        const { streamId, streamTransfer, action } = msg.data;
        const stream = _Stream.openStreams.get(streamId);
        if (stream && !stream.isClosed) {
          if (action === "transfer")
            stream.emitter.emit("message", streamTransfer);
          if (action === "close") {
            _Stream.openStreams.delete(streamId);
            stream.handleStreamClose();
          }
        }
      });
      _Stream.initDone = true;
    }
    _Stream.openStreams.set(t.streamId, this);
  }
  get info() {
    return this.internalInfo;
  }
  send(msg) {
    if (this.isClosed)
      throw new Error("Attempting to send a message over closed stream. Use stream.onClose(<callback>) to keep an eye on stream status");
    sendMessage("__crx_bridge_stream_transfer__", {
      streamId: this.internalInfo.streamId,
      streamTransfer: msg,
      action: "transfer"
    }, this.internalInfo.endpoint);
  }
  close(msg) {
    if (msg)
      this.send(msg);
    this.handleStreamClose();
    sendMessage("__crx_bridge_stream_transfer__", {
      streamId: this.internalInfo.streamId,
      streamTransfer: null,
      action: "close"
    }, this.internalInfo.endpoint);
  }
  onMessage(callback) {
    return this.getDisposable("message", callback);
  }
  onClose(callback) {
    return this.getDisposable("closed", callback);
  }
  getDisposable(event, callback) {
    const off = this.emitter.on(event, callback);
    return Object.assign(off, {
      dispose: off,
      close: off
    });
  }
};
var Stream = _Stream;
Stream.initDone = false;
Stream.openStreams = /* @__PURE__ */ new Map();

// src/bridge.ts
var import_tiny_uid3 = __toESM(require("tiny-uid"));
var import_nanoevents2 = require("nanoevents");
var openStreams = /* @__PURE__ */ new Map();
var onOpenStreamCallbacks = /* @__PURE__ */ new Map();
var streamyEmitter = (0, import_nanoevents2.createNanoEvents)();
onMessage("__crx_bridge_stream_open__", (message) => {
  return new Promise((resolve) => {
    const { sender, data } = message;
    const { channel } = data;
    let watching = false;
    let off = () => {
    };
    const readyup = () => {
      const callback = onOpenStreamCallbacks.get(channel);
      if (typeof callback === "function") {
        callback(new Stream({ ...data, endpoint: sender }));
        if (watching)
          off();
        resolve(true);
      } else if (!watching) {
        watching = true;
        off = streamyEmitter.on("did-change-stream-callbacks", readyup);
      }
    };
    readyup();
  });
});
async function openStream(channel, destination) {
  if (openStreams.has(channel))
    throw new Error("webext-bridge: A Stream is already open at this channel");
  const endpoint = typeof destination === "string" ? parseEndpoint(destination) : destination;
  const streamInfo = { streamId: (0, import_tiny_uid3.default)(), channel, endpoint };
  const stream = new Stream(streamInfo);
  stream.onClose(() => openStreams.delete(channel));
  await sendMessage("__crx_bridge_stream_open__", streamInfo, endpoint);
  openStreams.set(channel, stream);
  return stream;
}
function onOpenStreamChannel(channel, callback) {
  if (onOpenStreamCallbacks.has(channel))
    throw new Error("webext-bridge: This channel has already been claimed. Stream allows only one-on-one communication");
  onOpenStreamCallbacks.set(channel, callback);
  streamyEmitter.emit("did-change-stream-callbacks");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Stream,
  allowWindowMessaging,
  getCurrentContext,
  isInternalEndpoint,
  onMessage,
  onOpenStreamChannel,
  openStream,
  parseEndpoint,
  sendMessage,
  setNamespace
});
