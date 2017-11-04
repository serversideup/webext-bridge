# crx-bridge

Messaging in Chrome extensions made super easy. Out of the box.

## How much easy exactly?

This much

<a name="example"></a>

```javascript
// Inside devtools script

import Bridge from 'crx-bridge';

async function main() {
    const response = await Bridge.sendMessage('are-we-ready', { really: true }, 'content-script');
    console.log('ready status', response); // > ready status   yes
}

main();
```

```javascript
// Inside content script

import Bridge from 'crx-bridge';

Bridge.onMessage('are-we-ready', async (message) => {
    const { data, sender, timestamp } = message;
    console.log(sender.path, timestamp); // > devtools@681   1509269137197
    const someResult = await Bridge.sendMessage('do-stuff', { age: 2 }, 'background')
    return someResult.count > 4 ? 'yes' : 'no');
})

```

```javascript
// Inside background script

import Bridge from 'crx-bridge';

Bridge.onMessage('do-stuff', (message) => {
    const { data, sender, timestamp } = message;
    console.log(sender.path, timestamp); // > content-script@681   1509269137199
    // return a Promise, sender will get resolved value
    return fetch(`https://api.example.com/stuff?age=${data.age}`)
})

```

> Examples above require transpilation and/or bundling using `webpack`/`babel`/`rollup`

`crx-bridge` handles everything for you as efficiently as possible. No more `chrome.runtime.sendMessage` or `chrome.runtime.onConnect` or `chrome.runtime.connect` ....

# Contents
 - [Setup](#setup)
 - [API](#api)
 - [Behaviour](#behaviour)
 - [Security Note](#security)
 - [Troubleshooting](#troubleshooting)

<a name="setup"></a>
# Setup

### Install

```bash
$ npm i crx-bridge
```

### Light it up

Just `import Bridge from 'crx-bridge'` wherever you need it and use as shown in [example above](#example)
> Even if your extension doesn't need a background page or wont be sending/receiving messages in background script.
<br> `crx-bridge` uses background/event context as staging area for messages, therefore it **must** loaded in background/event page for it to work.
<br> (Attempting to send message from any context will fail silently if `crx-bridge` isn't available in background page).
<br> See [troubleshooting section](#troubleshooting) for more.


<a name="api"></a>
# API


## `Bridge.sendMessage(messageId: string, data: any, destination: string)`
Sends a message to some other part of your extension, out of the box.

Listener on the other may want to reply. Get the reply by `await`ing the returned `Promise`

#### `messageId`
> Required | `string`

Any `string` that both sides of your extension agree on. Could be `get-flag-count` or `getFlagCount`, as long as it's same on receiver's `onMessage` listener.

#### `data`
> Required | `any`

Any value you want to pass to other side, latter can access this value by refering to `data` property of first argument to `onMessage` callback function.

#### `destination`
> Required | `string`

The actual identifier of other endpoint.
Example: `devtools` or `content-script` or `background` or `content-script@133` or `devtools@453` or `content-script@13:frame#2`

Structure:
 - Must begin with known roots - `background` or `content-script` or `devtools` or `window`
 - `content-script`, `window` and `devtools` roots can be followed by `frame`(s), separated by `':'`, like `content-script:frame#3` (here #3 means third frame from top (zero-index based))
 - Known root can only occur once or put another way, applicable roots can only be followed by `frame`(s), separated by `:`
 - `frame`(s) can be followed by `frame`(s), like `content-script@14:frame:frame#2`
 - `content-script`, `window` and `devtools` roots can be suffixed with `@tabId` to target specific tab. Example: `devtools@351`, points to devtools panel inspecting tab with id 351.

 Read `Behaviour` section to see how destinations (or endpoints) are treated.

 > Note: For security reasons, if you want to receive or send messages to or from `window` root context or any `frame` context, one of your extension's content script must call `Bridge.enableExternalMessaging(<namespace: string>)` to unlock message routing. Also call `Bridge.setNamespace(<namespace: string>)` in those `window` or `frame` contexts. Use same namespace string in those two calls, so `crx-bridge` knows which message belongs to which extension (in case multiple extensions are using `crx-bride` in one page)

___

 ## `Bridge.onMessage(messageId: string, callback: fn)`
Register one and only one listener, per messageId per context. That will be called upon `Bridge.sendMessage` from other side.

Optionally, send a response to sender by returning any value or if async a `Promise`.

#### `messageId`
> Required | `string`

Any `string` that both sides of your extension agree on. Could be `get-flag-count` or `getFlagCount`, as long as it's same in sender's `sendMessage` call.

#### `callback`
> Required | `fn`

A callback function `Bridge` should call when a message is received with same `messageId`. The callback function will be called with one argument, a `BridgeMessage` which has `sender`, `data` and `timestamp` as its properties.

Optionally, this callback can return a value or a `Promise`, resolved value will sent as reply to sender.

Read [security note](#security) before using this.

___

 ## `Bridge.enableExternalMessaging(namespace: string)`
> Caution: Dangerous action

Applicable to content scripts (noop if called from anywhere else)

Unlocks the transmission of messages to and from `window` and `frame` contexts in the tab where it is called.
`crx-bridge` by default won't transmit any payload to or from `window` and `frame` contexts for security reasons.
This method can be called from a content script (in top frame of tab), which opens a gateway for messages.

`window` = the top frame of any tab
`frame`(s) = sub-frames as iframes of `window` or `frame`(s)

#### `namespace`
> Required | `string`

Can be a domain name reversed like `com.github.facebook.react_devtools` or any `uuid`. Call `Bridge.setNamespace` in `window` and `frame` contexts with same value, so that `crx-bridge` knows which payload belongs to which extension (in case there are other extensions using `crx-bridge` in a tab). Make sure namespace string is unique enough to 
ensure no collisions happen.

___

 ## `Bridge.setNamespace(namespace: string)`

Applicable to scripts in regular web pages.

Sets the namespace `Bridge` should use when relaying messages to and from `window` or `frame`(s). In a sense, it connects the callee context to the extension which called `Bridge.enableExternalMessaging(<namespace: string>)` in it's content script with same namespace.

#### `namespace`
> Required | `string`

Can be a domain name reversed like `com.github.facebook.react_devtools` or any `uuid`. Call `Bridge.setNamespace` in `window` and `frame` contexts with same value, so that `crx-bridge` knows which payload belongs to which extension (in case there are other extensions using `crx-bridge` in a tab). Make sure namespace string is unique enough to ensure no collisions happen.

## Extras

The following API is built on top of `Bridge.sendMessage` and `Bridge.onMessage`, in other words, it's just a wrapper, the routing and security rules still apply the same way.

### `Bridge.openStream(channel: string, destination: string)`

Opens a `Stream` between caller and destination.

Returns a `Promise` which resolves with `Stream` when the destination is ready (loaded and `Bridge.onOpenStreamChannel` callback registered).
Example below illustrates a use case for `Stream`

#### `channel`
> Required | `string`

`Stream`(s) are strictly scoped `Bridge.sendMessage`(s). Scopes could be different features of your extension that need to talk to the other side, and those scopes are named using a channel id.

#### `destination`
> Required | `string`

Same as `destination` in `Bridge.sendMessage(msgId, data, destination)`

___

### `Bridge.onOpenStreamChannel(channel: string, callback: fn)`

Registers a listener for when a `Stream` opens.
Only one listener per channel per context

#### `channel`
> Required | `string`

`Stream`(s) are strictly scoped `Bridge.sendMessage`(s). Scopes could be different features of your extension that need to talk to the other side, and those scopes are named using a channel id.

#### `callback`
> Required | `fn`

Callback that should be called whenever `Stream` is opened from the other side. Callback will be called with one argument, the `Stream` object, documented below.

`Stream`(s) can be opened by a malicious webpage(s) if a tab's content script has called `Bridge.enableExternalMessaging`, if working with sensitive information use `stream.info.endpoint.isInternal()` to check, if `false` call `stream.close()` immediately.

### Stream Example

```javascript
// background.js

// To-Do

```

<a name="behaviour"></a>
# Behaviour

> Following rules apply to destination being specified in `Bridge.sendMessage(msgId, data, destination)` and `Bridge.openStream(channelId, initialData, destination)`

 - Specifying `devtools` as destination from `content-script` will auto-route payload to  inspecting `devtools` page if open and listening.

 - Specifying `content-script` as destination from `devtools` will auto-route the message to  inspected window's top `content-script` page if listening. If page is loading, message will be queued up and deliverd when page is ready and listening.

 - If `frame` or `window` (which could be a script injected by content script) are source or destination of any payload, transmission must be first unlocked by calling `Bridge.enableExternalMessagin(<namespace: string>)` inside a content script, since `Bridge` will first deliver the payload to `content-script` using rules above, and latter will take over and forward accordingly. `content-script` <-> `window`, `window` <-> `frame`, `frame` <-> `frame` and `content-script` <-> `frame` messaging happens using `window.postMessage` API. Therefore to avoid conflicts, `Bridge` requires you to call `Bridge.setNamespace(uuidOrReverseDomain)` inside `window` and `frame` contexts (even if they are just relaying a payload across), before routing occurs.

 - The rule above does not apply to `frame`(s) inside `devtools`. Bridge assumes that everything you load up in devtools panel is all under your ownership and control. However in a tab, there might be other extensions using `crx-bridge`. Calling `Bridge.sendMessage(msgId, data, 'devtools:frame#1:frame')` from `content-script` will work out of the box.

 - Routing to and from `window` or `frame` contexts will only work if there is content script loaded in top frame of the page. The same page which hosts those `window` or `frame`(s). The content script must also have `crx-bridge` imported and a call to `Bridge.enableExternalMessagin(<namespace: string>)`

 - Specifying `devtools` or `content-script` or `window` from `background` will throw an error. When calling from `background`, destination must be suffixed with tab id. Like `devtools@745` for `devtools` inspecting tab id 745 or `content-script@351` for top `content-script` at tab id 351.

<a name="security"></a>
 # Serious security note

 The following note only applies if and only if, you will be sending/receiving messages to/from `window` or `frame` contexts. There's no security concern if you will be only working with `content-script`, `background` or `devtools` scope.

 `window` and `frame` contexts get unlocked the moment you call `Bridge.enableExternalMessaging(namespace)` somewhere in your extenion's content script(s).

 Unlike `chrome.runtime.sendMessage` and `chrome.runtime.connect`, which requires extension's manifest to specify sites allowed to talk with the extension, `crx-bridge` has no such measure by design, which means any webpage whether you intended or not, can do `Bridge.sendMessage(msgId, data, 'background')` or something similar that produces same effect, as long as it uses same protocol used by `crx-bridge` and namespace set to same as yours.

 So to be safe, if you will be interacting with `window` or `frame` contexts, treat `crx-bridge` as you would treat `window.postMessage` API.

 As an example if you plan on having something critical, **always** verify the `sender` before responding:

```javascript
// background.js

Bridge.onMessage('getUserBrowsingHistory', (message) => {
    const { data, sender } = message;
    // Respond only if request is from 'devtools', 'content-script' or 'background' endpoint
    if(sender.isInternal()) {
        const { range } = data;
        return getHistory(range);
    }
})
```

> Since `crx-bridge` assumes you have full control over what loads in your devtools panel, `sender.isInternal()` will return `true` for `devtools:frame#2:frame#1`
<br> Alternatively use `sender.isReallyInternal()` to return `false` in such cases.

<a name="troubleshooting"></a>
# Troubleshooting

 - Doesn't work?
 <br>If `window` and `frame` contexts are not part of the puzzle, `crx-bridge` works out of the box for messaging between `devtools` <-> `background` <-> `content-script`(s). If even that is not working, it's likely that `crx-bridge` hasn't been loaded in background page of your extension, which is used by `crx-bridge` as a staging area. If you don't need a background page for yourself, here's bare minimum to get `crx-bridge` going.
 ```javascript
 // background.js (requires transpilation/bundling using webpack(recommended))
 import 'crx-bridge';
 ```

 ```javascript
 // manifest.json
 {
     "background": {
         "scripts": ["path/to/transpiled/background.js"]
     }
 }
 ```

 - Can't send messages to `window`?
 <br>Sending or receiving messages from or to `window` (and `frame`(s)) requires you to open the messaging gateway in content script(s) for that particular tab. Call `Bridge.enableExternalMessaging(<namespaceA: string>)` in any of your content script(s) and call `Bridge.setNamespace(<namespaceB: string>)` in webpage or `window` context. Make sure that `namespaceA === namespaceB`. If you're doing this, read the [security note above](#security)