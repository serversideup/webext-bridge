<p align="center">
		<img src="./.github/header.png" width="1200" alt="webext-bridge Header" />
</p>
<p align="center">
	<a href="https://actions-badge.atrox.dev/serversideup/webext-bridge/goto?ref=main"><img alt="Build Status" src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fserversideup%2Fwebext-bridge%2Fbadge%3Fref%3Dmain&style=flat" /></a>
	<a href="https://github.com/serversideup/webext-bridge/blob/main/LICENSE" target="_blank"><img src="https://badgen.net/github/license/serversideup/webext-bridge" alt="License"></a>
	<a href="https://github.com/sponsors/serversideup"><img src="https://badgen.net/badge/icon/Support%20Us?label=GitHub%20Sponsors&color=orange" alt="Support us"></a>
	<br />
	<a href="https://www.npmjs.com/package/webext-bridge"><img alt="npm" src="https://img.shields.io/npm/dm/webext-bridge?color=red&label=downloads&logo=npm"></a>
	<a href="https://www.npmjs.com/package/webext-bridge"><img alt="npm" src="https://img.shields.io/npm/v/webext-bridge?color=2B90B6&label=Latest"></a>
  <a href="https://serversideup.net/discord"><img alt="Discord" src="https://img.shields.io/discord/910287105714954251?color=blueviolet"></a>
</p>

> [!IMPORTANT]  
> **`webext-bridge` just joined the Server Side Up family of open source projects.** [Read the announcement →](https://github.com/serversideup/webext-bridge/discussions/74)

# Introduction
**Messaging in web extensions made easy. Batteries included.** Reduce headache and simplify the effort of keeping data in sync across different parts of your extension. `webext-bridge` is a tiny library that provides a simple and consistent API for sending and receiving messages between different parts of your web extension, such as `background`, `content-script`, `devtools`, `popup`, `options`, and `window` contexts.

## Example

<a name="example"></a>

```javascript
// Inside devtools script

import { sendMessage } from "webext-bridge/devtools";

button.addEventListener("click", async () => {
  const res = await sendMessage(
    "get-selection",
    { ignoreCasing: true },
    "content-script"
  );
  console.log(res); // > "The brown fox is alive and well"
});
```

```javascript
// Inside content script

import { sendMessage, onMessage } from "webext-bridge/content-script";

onMessage("get-selection", async (message) => {
  const {
    sender,
    data: { ignoreCasing },
  } = message;

  console.log(sender.context, sender.tabId); // > devtools  156

  const { selection } = await sendMessage(
    "get-preferences",
    { sync: false },
    "background"
  );
  return calculateSelection(data.ignoreCasing, selection);
});
```

```javascript
// Inside background script

import { onMessage } from "webext-bridge/background";

onMessage("get-preferences", ({ data }) => {
  const { sync } = data;

  return loadUserPreferences(sync);
});
```

> Examples above require transpilation and/or bundling using `webpack`/`babel`/`rollup`

`webext-bridge` handles everything for you as efficiently as possible. No more `chrome.runtime.sendMessage` or `chrome.runtime.onConnect` or `chrome.runtime.connect` ....

## Learn how to use "webext-bridge" with our book
We put together a comprehensive guide to help people build multi-platform browser extensions. The book covers everything from getting started to advanced topics like messaging, storage, and debugging. It's a great resource for anyone looking to build a browser extension. The book specifically covers how to use `webext-bridge` to simplify messaging in your extension.

<a href="https://serversideup.net/building-multi-platform-browser-extensions/"><img src="https://serversideup.net/wp-content/uploads/2024/02/ExtensionBook-Twitter-2.png" title="Documentation" width="100%"></a>

## Setup

### Install

```bash
$ npm i webext-bridge
```

#### Light it up

Just `import { } from 'webext-bridge/{context}'` wherever you need it and use as shown in [example above](#example)

> Even if your extension doesn't need a background page or wont be sending/receiving messages in background script.
> <br> `webext-bridge` uses background/event context as staging area for messages, therefore it **must** loaded in background/event page for it to work.
> <br> (Attempting to send message from any context will fail silently if `webext-bridge` isn't available in background page).
> <br> See [troubleshooting section](#troubleshooting) for more.

<a name="api"></a>

## Type Safe Protocols

As we are likely to use `sendMessage` and `onMessage` in different contexts, keeping the type consistent could be hard, and its easy to make mistakes. `webext-bridge` provide a smarter way to make the type for protocols much easier.

Create `shim.d.ts` file with the following content and make sure it's been included in `tsconfig.json`.

```ts
// shim.d.ts

import type { ProtocolWithReturn } from "webext-bridge";

declare module "webext-bridge" {
  export interface ProtocolMap {
    foo: { title: string };
    // to specify the return type of the message,
    // use the `ProtocolWithReturn` type wrapper
    bar: ProtocolWithReturn<CustomDataType, CustomReturnType>;
  }
}
```

```ts
import { onMessage } from 'webext-bridge/content-script'

onMessage('foo', ({ data }) => {
  // type of `data` will be `{ title: string }`
  console.log(data.title)
}
```

```ts
import { sendMessage } from "webext-bridge/background";

const returnData = await sendMessage("bar", {
  /* ... */
});
// type of `returnData` will be `CustomReturnType` as specified
```

## API

### `sendMessage(messageId: string, data: any, destination: string)`

Sends a message to some other part of your extension.

Notes:

- If there is no listener on the other side an error will be thrown where `sendMessage` was called.

- Listener on the other may want to reply. Get the reply by `await`ing the returned `Promise`

- An error thrown in listener callback (in the destination context) will behave as usual, that is, bubble up, but the same error will also be thrown where `sendMessage` was called

- If the listener receives the message but the destination disconnects (tab closure for exmaple) before responding, `sendMessage` will throw an error in the sender context.

##### `messageId`

> Required | `string`

Any `string` that both sides of your extension agree on. Could be `get-flag-count` or `getFlagCount`, as long as it's same on receiver's `onMessage` listener.

##### `data`

> Required | `any`

Any serializable value you want to pass to other side, latter can access this value by refering to `data` property of first argument to `onMessage` callback function.

##### `destination`

> Required | `string | `

The actual identifier of other endpoint.
Example: `devtools` or `content-script` or `background` or `content-script@133` or `devtools@453`

`content-script`, `window` and `devtools` destinations can be suffixed with `@<tabId>` to target specific tab. Example: `devtools@351`, points to devtools panel inspecting tab with id 351.

For `content-script`, a specific `frameId` can be specified by appending the `frameId` to the suffix `@<tabId>.<frameId>`.

Read `Behavior` section to see how destinations (or endpoints) are treated.

> Note: For security reasons, if you want to receive or send messages to or from `window` context, one of your extension's content script must call `allowWindowMessaging(<namespace: string>)` to unlock message routing. Also call `setNamespace(<namespace: string>)` in those `window` contexts. Use same namespace string in those two calls, so `webext-bridge` knows which message belongs to which extension (in case multiple extensions are using `webext-bridge` in one page)

---

### `onMessage(messageId: string, callback: fn)`

Register one and only one listener, per messageId per context. That will be called upon `sendMessage` from other side.

Optionally, send a response to sender by returning any value or if async a `Promise`.

##### `messageId`

> Required | `string`

Any `string` that both sides of your extension agree on. Could be `get-flag-count` or `getFlagCount`, as long as it's same in sender's `sendMessage` call.

##### `callback`

> Required | `fn`

A callback function `Bridge` should call when a message is received with same `messageId`. The callback function will be called with one argument, a `BridgeMessage` which has `sender`, `data` and `timestamp` as its properties.

Optionally, this callback can return a value or a `Promise`, resolved value will sent as reply to sender.

Read [security note](#security) before using this.

---

### `allowWindowMessaging(namespace: string)`

> Caution: Dangerous action

API available only to content scripts

Unlocks the transmission of messages to and from `window` (top frame of loaded page) contexts in the tab where it is called.
`webext-bridge` by default won't transmit any payload to or from `window` contexts for security reasons.
This method can be called from a content script (in top frame of tab), which opens a gateway for messages.

Once again, `window` = the top frame of any tab. That means **allowing window messaging without checking origin first** will let JavaScript loaded at `https://evil.com` talk with your extension and possibly give indirect access to things you won't want to, like `history` API. You're expected to ensure the
safety and privacy of your extension's users.

##### `namespace`

> Required | `string`

Can be a domain name reversed like `com.github.facebook.react_devtools` or any `uuid`. Call `setNamespace` in `window` context with same value, so that `webext-bridge` knows which payload belongs to which extension (in case there are other extensions using `webext-bridge` in a tab). Make sure namespace string is unique enough to ensure no collisions happen.

---

### `setNamespace(namespace: string)`

API available to scripts in top frame of loaded remote page

Sets the namespace `Bridge` should use when relaying messages to and from `window` context. In a sense, it connects the callee context to the extension which called `allowWindowMessaging(<namespace: string>)` in it's content script with same namespace.

##### `namespace`

> Required | `string`

Can be a domain name reversed like `com.github.facebook.react_devtools` or any `uuid`. Call `setNamespace` in `window` context with same value, so that `webext-bridge` knows which payload belongs to which extension (in case there are other extensions using `webext-bridge` in a tab). Make sure namespace string is unique enough to ensure no collisions happen.

### Extras

The following API is built on top of `sendMessage` and `onMessage`, basically, it's just a wrapper, the routing and security rules still apply the same way.

#### `openStream(channel: string, destination: string)`

Opens a `Stream` between caller and destination.

Returns a `Promise` which resolves with `Stream` when the destination is ready (loaded and `onOpenStreamChannel` callback registered).
Example below illustrates a use case for `Stream`

##### `channel`

> Required | `string`

`Stream`(s) are strictly scoped `sendMessage`(s). Scopes could be different features of your extension that need to talk to the other side, and those scopes are named using a channel id.

##### `destination`

> Required | `string`

Same as `destination` in `sendMessage(msgId, data, destination)`

---

#### `onOpenStreamChannel(channel: string, callback: fn)`

Registers a listener for when a `Stream` opens.
Only one listener per channel per context

##### `channel`

> Required | `string`

`Stream`(s) are strictly scoped `sendMessage`(s). Scopes could be different features of your extension that need to talk to the other side, and those scopes are named using a channel id.

##### `callback`

> Required | `fn`

Callback that should be called whenever `Stream` is opened from the other side. Callback will be called with one argument, the `Stream` object, documented below.

`Stream`(s) can be opened by a malicious webpage(s) if your extension's content script in that tab has called `allowWindowMessaging`, if working with sensitive information use `isInternalEndpoint(stream.info.endpoint)` to check, if `false` call `stream.close()` immediately.

##### Stream Example

```javascript
// background.js

// To-Do
```

<a name="behaviour"></a>

## Behavior

> Following rules apply to `destination` being specified in `sendMessage(msgId, data, destination)` and `openStream(channelId, initialData, destination)`

- Specifying `devtools` as destination from `content-script` will auto-route payload to inspecting `devtools` page if open and listening. If devtools are not open, message will be queued up and
  delivered when devtools are opened and the user switches to your extension's devtools panel.

- Specifying `content-script` as destination from `devtools` will auto-route the message to inspected window's top `content-script` page if listening. If page is loading, message will be queued up and delivered when page is ready and listening.

- If `window` context (which could be a script injected by content script) are source or destination of any payload, transmission must be first unlocked by calling `allowWindowMessaging(<namespace: string>)` inside that page's top content script, since `Bridge` will first deliver the payload to `content-script` using rules above, and latter will take over and forward accordingly. `content-script` <-> `window` messaging happens using `window.postMessage` API. Therefore to avoid conflicts, `Bridge` requires you to call `setNamespace(uuidOrReverseDomain)` inside the said window script (injected or remote, doesn't matter).

- Specifying `devtools` or `content-script` or `window` from `background` will throw an error. When calling from `background`, destination must be suffixed with tab id. Like `devtools@745` for `devtools` inspecting tab id 745 or `content-script@351` for top `content-script` at tab id 351.

<a name="security"></a>

## Serious security note

The following note only applies if and only if, you will be sending/receiving messages to/from `window` contexts. There's no security concern if you will be only working with `content-script`, `background`, `popup`, `options`, or `devtools` scope, which is the default setting.

`window` context(s) in tab `A` get unlocked the moment you call `allowWindowMessaging(namespace)` somewhere in your extension's content script(s) that's also loaded in tab `A`.

Unlike `chrome.runtime.sendMessage` and `chrome.runtime.connect`, which requires extension's manifest to specify sites allowed to talk with the extension, `webext-bridge` has no such measure by design, which means any webpage whether you intended or not, can do `sendMessage(msgId, data, 'background')` or something similar that produces same effect, as long as it uses same protocol used by `webext-bridge` and namespace set to same as yours.

So to be safe, if you will be interacting with `window` contexts, treat `webext-bridge` as you would treat `window.postMessage` API.

Before you call `allowWindowMessaging`, check if that page's `window.location.origin` is something you expect already.

As an example if you plan on having something critical, **always** verify the `sender` before responding:

```javascript
// background.js

import { onMessage, isInternalEndpoint } from "webext-bridge/background";

onMessage("getUserBrowsingHistory", (message) => {
  const { data, sender } = message;
  // Respond only if request is from 'devtools', 'content-script', 'popup', 'options', or 'background' endpoint
  if (isInternalEndpoint(sender)) {
    const { range } = data;
    return getHistory(range);
  }
});
```

<a name="troubleshooting"></a>

## Troubleshooting

- Doesn't work?
  <br>If `window` contexts are not part of the puzzle, `webext-bridge` works out of the box for messaging between `devtools` <-> `background` <-> `content-script`(s). If even that is not working, it's likely that `webext-bridge` hasn't been loaded in background page of your extension, which is used by `webext-bridge` as a relay. If you don't need a background page for yourself, here's bare minimum to get `webext-bridge` going.

```javascript
// background.js (requires transpiration/bundling using webpack(recommended))

import "webext-bridge/background";
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
  <br>Sending or receiving messages from or to `window` requires you to open the messaging gateway in content script(s) for that particular tab. Call `allowWindowMessaging(<namespaceA: string>)` in any of your content script(s) in that tab and call `setNamespace(<namespaceB: string>)` in the
  script loaded in top frame i.e the `window` context. Make sure that `namespaceA === namespaceB`. If you're doing this, read the [security note above](#security)

## Resources
<!-- - **[Website](https://serversideup.net/open-source/webext-bridge/)** overview of the product.
- **[Docs](https://serversideup.net/open-source/webext-bridge/docs)** for a deep-dive on how to use the product. -->
- **[Discord](https://serversideup.net/discord)** for friendly support from the community and the team.
- **[GitHub](https://github.com/serversideup/webext-bridge)** for source code, bug reports, and project management.
- **[Get Professional Help](https://serversideup.net/professional-support)** - Get video + screen-sharing help directly from the core contributors.

## Contributing
As an open-source project, we strive for transparency and collaboration in our development process. We greatly appreciate any contributions members of our community can provide. Whether you're fixing bugs, proposing features, improving documentation, or spreading awareness - your involvement strengthens the project. Please review our [contribution guidelines](https://serversideup.net/open-source/webext-bridge/docs/community/contributing) and [code of conduct](./.github/code_of_conduct.md) to understand how we work together respectfully.

- **Bug Report**: If you're experiencing an issue while using these images, please [create an issue](https://github.com/serversideup/webext-bridge/issues/new/choose).
- **Feature Request**: Make this project better by [submitting a feature request](https://github.com/serversideup/webext-bridge/discussions/76).
- **Documentation**: Improve our documentation by [submitting a documentation change](./docs/README.md).
- **Community Support**: Help others on [GitHub Discussions](https://github.com/serversideup/webext-bridge/discussions) or [Discord](https://serversideup.net/discord).
- **Security Report**: Report critical security issues via [our responsible disclosure policy](https://www.notion.so/Responsible-Disclosure-Policy-421a6a3be1714d388ebbadba7eebbdc8).

Need help getting started? Join our Discord community and we'll help you out!

<a href="https://serversideup.net/discord"><img src="https://serversideup.net/wp-content/themes/serversideup/images/open-source/join-discord.svg" title="Join Discord"></a>

## Our Sponsors
All of our software is free an open to the world. None of this can be brought to you without the financial backing of our sponsors.

<p align="center"><a href="https://github.com/sponsors/serversideup"><img src="https://521public.s3.amazonaws.com/serversideup/sponsors/sponsor-box.png" alt="Sponsors"></a></p>

#### Individual Supporters
<!-- supporters --><a href="https://github.com/alexjustesen"><img src="https://github.com/alexjustesen.png" width="40px" alt="alexjustesen" /></a>&nbsp;&nbsp;<a href="https://github.com/GeekDougle"><img src="https://github.com/GeekDougle.png" width="40px" alt="GeekDougle" /></a>&nbsp;&nbsp;<!-- supporters -->

## About Us
We're [Dan](https://twitter.com/danpastori) and [Jay](https://twitter.com/jaydrogers) - a two person team with a passion for open source products. We created [Server Side Up](https://serversideup.net) to help share what we learn.

<div align="center">

| <div align="center">Dan Pastori</div>                  | <div align="center">Jay Rogers</div>                                 |
| ----------------------------- | ------------------------------------------ |
| <div align="center"><a href="https://twitter.com/danpastori"><img src="https://serversideup.net/wp-content/uploads/2023/08/dan.jpg" title="Dan Pastori" width="150px"></a><br /><a href="https://twitter.com/danpastori"><img src="https://serversideup.net/wp-content/themes/serversideup/images/open-source/twitter.svg" title="Twitter" width="24px"></a><a href="https://github.com/danpastori"><img src="https://serversideup.net/wp-content/themes/serversideup/images/open-source/github.svg" title="GitHub" width="24px"></a></div>                        | <div align="center"><a href="https://twitter.com/jaydrogers"><img src="https://serversideup.net/wp-content/uploads/2023/08/jay.jpg" title="Jay Rogers" width="150px"></a><br /><a href="https://twitter.com/jaydrogers"><img src="https://serversideup.net/wp-content/themes/serversideup/images/open-source/twitter.svg" title="Twitter" width="24px"></a><a href="https://github.com/jaydrogers"><img src="https://serversideup.net/wp-content/themes/serversideup/images/open-source/github.svg" title="GitHub" width="24px"></a></div>                                       |

</div>

### Find us at:

* **📖 [Blog](https://serversideup.net)** - Get the latest guides and free courses on all things web/mobile development.
* **🙋 [Community](https://community.serversideup.net)** - Get friendly help from our community members.
* **🤵‍♂️ [Get Professional Help](https://serversideup.net/professional-support)** - Get video + screen-sharing support from the core contributors.
* **💻 [GitHub](https://github.com/serversideup)** - Check out our other open source projects.
* **📫 [Newsletter](https://serversideup.net/subscribe)** - Skip the algorithms and get quality content right to your inbox.
* **🐥 [Twitter](https://twitter.com/serversideup)** - You can also follow [Dan](https://twitter.com/danpastori) and [Jay](https://twitter.com/jaydrogers).
* **❤️ [Sponsor Us](https://github.com/sponsors/serversideup)** - Please consider sponsoring us so we can create more helpful resources.

## Our products
If you appreciate this project, be sure to check out our other projects.

### 📚 Books
- **[The Ultimate Guide to Building APIs & SPAs](https://serversideup.net/ultimate-guide-to-building-apis-and-spas-with-laravel-and-nuxt3/)**: Build web & mobile apps from the same codebase.
- **[Building Multi-Platform Browser Extensions](https://serversideup.net/building-multi-platform-browser-extensions/)**: Ship extensions to all browsers from the same codebase.

### 🛠️ Software-as-a-Service
- **[Bugflow](https://bugflow.io/)**: Get visual bug reports directly in GitHub, GitLab, and more.
- **[SelfHost Pro](https://selfhostpro.com/)**: Connect Stripe or Lemonsqueezy to a private docker registry for self-hosted apps.

### 🌍 Open Source
- **[serversideup/php Docker Images](https://serversideup.net/open-source/docker-php/)**: PHP Docker images optimized for Laravel and running PHP applications in production.
- **[Financial Freedom](https://github.com/serversideup/financial-freedom)**: Open source alternative to Mint, YNAB, & Monarch Money.
- **[AmplitudeJS](https://521dimensions.com/open-source/amplitudejs)**: Open-source HTML5 & JavaScript Web Audio Library.
- **[webext-bridge](https://github.com/serversideup/webext-bridge)**: Messaging in web extensions made easy. Batteries included.
