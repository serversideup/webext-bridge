# webext-bridge

WebExtensions 中的消息传递变得非常简单。开箱即用！

例子：

```js
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

```js
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

> 以上例子，在使用 `webpack`/`babel`/`rollup` 时需要转译和/或 bundling

`webext-bridge` 尽可能高效地为您处理一切。不再需要 `chrome.runtime.sendMessage` 或 `chrome.runtime.onConnect` 或 `chrome.runtime.connect`....

## 设置

### 安装

`$ npm i webext-bridge`

#### 启动起来

在任何你需要的地方[类似上面](https://github.com/zikaari/webext-bridge#example)那样 `import { } from 'webext-bridge/{context}'` 使用即可。

> 即使您的扩展程序不需要后台页面或不会在后台脚本中发送/接收消息。
> `webext-bridge` 使用后台/事件上下文作为消息的暂存区，因此它必须加载到后台/事件页面才能工作。
>（如果在后台页面中不可用，则尝试从任何上下文发送消息都将无提示地失败）。
> 有关更多信息，请参阅[故障排除部分](https://github.com/zikaari/webext-bridge#troubleshooting)。

## 类型安全协议

由于我们可能会在不同的上下文中使用 `sendMessage` 及 `onMessage`，保持类型一致可能很困难，而且很容易出错。`webext-bridge` 提供一种更智能的方法来使协议的类型更容易。

使用以下内容创建 `shim.d.ts` 文件并确保它已包含在 `tsconfig.json`。

```ts
// shim.d.ts

import { ProtocolWithReturn } from "webext-bridge";

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

向扩展程序的其他部分发送消息。

注意：

- 如果另一端没有侦听器，则会在 `sendMessage` 调用的地方抛出错误。
- 另一方的侦听器可能想要回复。通过 `await` 获取返回的回复 `Promise`
- 侦听器回调中抛出的错误（在目标上下文中）将像往常一样运行，即冒泡，但同样的错误也会在 `sendMessage` 调用的地方抛出
- 如果侦听器收到消息但目标在响应之前断开连接（例如，浏览器标签页关闭），`sendMessage` 将在发送方上下文中抛出错误。

##### `messageId`

> Required | `string`

`string` 扩展双方都同意的任何内容。可以是 `get-flag-countor` 或 `getFlagCount`，只要它在接收者的 `onMessage` 监听器上是相同的。

##### `data`

> Required | `any`

您想要传递给另一方的任何可序列化值，后者（监听方）可以通过 `onMessage` 回调函数的第一个参数 `data` 的属性引用来访问该值。

##### `destination`

> Required | `string |`

其他端点的实际标识符。示例：`devtools` 或 `content-script` 或 `background` 或 `content-script@133` 或 `devtools@453`

`content-script`, `window` 及 `devtools` 的目标后缀可以 `@<tabId>` 定位特定的标签页。例如：`devtools@351`，指向 ID 为 351 的 devtools 面板检查标签页。

对于 `content-script`，可以通过将 `frameId` 附加到后缀来指定具体的 `frameId`, 例如：`@<tabId>.<frameId>`

阅读 `行为` 部分以了解如何处理目的地（或端点）。

> 注意：出于安全原因，如果您想要从上下文接收消息或从 `window` 上下文发送消息，您的扩展的内容脚本之一必须调用 `allowWindowMessaging(<namespace: string>)` 以解锁消息路由。同时也在那些 `window` 上下文中调用 `setNamespace(<namespace: string>)`。在这两个调用中使用相同的命名空间字符串，这样 `webext-bridge` 才知道哪个消息属于哪个扩展（以防 `webext-bridge` 在一个页面中使用多个扩展）。

---

### `onMessage(messageId: string, callback: fn)`

每个上下文的每个 `messageId` 注册一个且仅一个侦听器。这将被另一方的 `sendMessage` 调用。

可选地，通过返回任何值或 `Promise`（如果是异步） 来向发送方发送响应。

##### `messageId`

> Required | `string`

`string` 扩展双方都同意的任何内容。可以是 `get-flag-countor` 或 `getFlagCount`，只要它在发送方的 `sendMessage` 调用是相同的。

##### `callback`

> Required | `fn`

当接收到相同的 `messageId` 消息时，`Bridge` 应调用的回调函数。将使用一个参数调用回调函数，该 `BridgeMessage` 参数具有 `sender`, `data` 和 `timestamp` 作为其属性。

可选地，此回调可以返回一个值或一个 `Promise` 已解析的值将作为回复发送给发送方。

使用前请阅读[安全说明](https://github.com/zikaari/webext-bridge/edit/main/README.md#security)。

---

### `allowWindowMessaging(namespace: string)`

> 注意：危险动作

API 仅适用于内容脚本

解锁在调用它的选项卡中与 `window`（加载页面的top frame）上下文之间的消息传输。出于安全原因，`webext-bridge` 默认情况下不会向 `window` 上下文传输任何有效负载。可以从内容脚本（在选项卡的top frame）调用此方法，这会打开一个消息网关。

再次强调，`window` = 任何选项卡的 top frame。这意味着 **允许窗口消息传递而不先检查来源** 将使加载来自 `https://evil.com`（某个有恶意的网站） 的 JavaScript 与您的扩展对话，并可能间接访问您不想被访问的内容，例如 `history` API。您应该确保您的扩展用户的安全和隐私。

#### `namespace`

> Required | `string`

可以是一个反向的域名，`com.github.facebook.react_devtools` 或 `uuid`。 在 `window` 上下文中使用相同的值调用 `setNamespace`，以便 `webext-bridge` 知道哪个有效负载属于哪个扩展（以防 `webext-bridge` 选项卡中使用其他扩展）。确保命名空间字符串足够唯一以保证不会发生冲突。

---

### `setNamespace(namespace: string)`

可用于已加载远程页面顶部框架中脚本的 API

设置在将消息中继到 `window` 上下文时 `Bridge` 应使用的名称空间。从某种意义上说，它将被调用者上下文连接到 `allowWindowMessaging(<namespace: string>)` 在其具有相同命名空间的内容脚本中调用的扩展。

##### `namespace`

> Required | `string`

可以是一个反向的域名，`com.github.facebook.react_devtools` 或 `uuid`。 在 `window` 上下文中使用相同的值调用 `setNamespace`，以便 `webext-bridge` 知道哪个有效负载属于哪个扩展（以防 `webext-bridge` 选项卡中使用其他扩展）。确保命名空间字符串足够唯一以保证不会发生冲突。

### 附加功能

下面的 API 建立在 `sendMessageand` 及 `onMessage` 之上，基本上，它只是一个包装器，路由和安全规则仍然以相同的方式应用。

#### `openStream(channel: string, destination: string)`

在呼叫者和目的地之间打开一个 `Stream`。

在目的地准备就绪（加载和 `OpenStreamChannel` 回调注册）时返回一个`Streamon` 解析的 `Promise` 对象。下面的示例说明了一个 `Stream` 用例

##### `channel`

> Required | `string`

`Stream`(s) 是严格限定范围的 `sendMessage`(s)。范围可能是您的扩展的不同功能，需要与另一方通信，并且这些范围使用通道 ID 命名。

##### `destination`

> Required | `string`

与 `sendMessage(msgId, data, destination)` 中的 `destination` 相同

---

#### `onOpenStreamChannel(channel: string, callback: fn)`

在 `Stream` 打开时注册一个侦听器。每个上下文每个通道只有一个侦听器。

##### `channel`

> Required | `string`

`Stream`(s) 是严格限定范围的 `sendMessage`(s)。范围可能是您的扩展的不同功能，需要与另一方通信，并且这些范围使用通道 ID 命名。

##### `callback`

> Required | `fn`

从另一端打开 `Stream` 时应调用的回调。将使用一个参数调用回调，即 `Stream` 对象，如下所述。

`Stream(s)` 可以被恶意网页打开，如果您的扩展程序在该选项卡中的内容脚本已调用 `allowWindowMessaging`，如果使用敏感信息则使用 `isInternalEndpoint(stream.info.endpoint)` 进行检查，如果为 `false` 立即调用 `stream.close()`。

##### 流示例

```javascript
// background.js

// To-Do
```

## 行为

> 以下规则适用于在 `sendMessage(msgId, data, destination)` 及 `openStream(channelId, initialData, destination)` 中的 `destination`

- 如果打开检查 `devtools` 页面，则指定 `devtools` 为目的地 `content-script` 将自动将有效负载路由到对应的 `devtools` 页面并侦听。 如果 `devtools` 未打开，消息则进入队列中直到 `devtools` 打开并且用户切换到您的扩展的 `devtools` 面板时才会被传递。

- 如果指定 `content-script` 为目的地 `devtools` 的页面在监听，将自动将消息路由到该窗口的最上层 `content-script` 页面。如果页面正在加载，消息进入队列并将在页面准备好时侦听并传递。

- 如果 `window` 上下文（可能是由内容脚本注入的脚本）是任何有效负载的源或目标，则必须首先通过该页面的顶部内容脚本调用 `allowWindowMessaging(<namespace: string>)` 来解锁传输，因为 `Bridge` 将首先将有效负载使用上面的规则传递给 `content-script`，而后者将接收并对应传递。`content-script` <-> `window` 消息传递使用 `window.postMessage` API。因此，为避免冲突，`Bridge` 需要您在上述窗口脚本内部调用 `setNamespace(uuidOrReverseDomain)`（注入或远程，无所谓）。

- 在 `background` 指定 `devtools` or `content-script` 或 `window` 将引发错误。从 `background` 调用时，`destination` 必须以 tab id 为后缀。比如 `devtools@745` 代表 `devtools` 检查标签 ID 745 或 `content-script@351` 指代最上层 `content-script` 的标签 ID 351。

## 重要的安全注意事项

以下说明仅当且仅当您将与 `window` 上下文发送/接收消息时才适用。如果您只使用 `content-script`、`background`、`popup`、`options` 或 `devtools` 范围（默认设置），则没有安全问题。

当您在扩展的内容脚本中某处调用 `allowWindowMessaging(namespace)` 时，选项卡 `A` 中的 `window` 上下文将被解锁，该内容脚本也已加载到选项卡 `A` 中。

与 `chrome.runtime.sendMessage` 和 `chrome.runtime.connect` 不同是，它们需要扩展程序的清单来指定允许与扩展程序对话的站点，而 `webext-bridge` 并没有这样的设计，这意味着无论您是否打算，任何网页都可以执行 `sendMessage(msgId, data, 'background')` 或产生相同效果的类似操作，只要它使用和 `webext-bridge` 相同的协议和并且和你设置的命名空间也一样即可。

因此，为了安全起见，如果您要与 `window` 上下文交互，对待 `webext-bridge` 要像 `window.postMessage` API 一样对待。

在您调用 `allowWindowMessaging` 之前，请检查该页面的 `window.location.origin` 是否符合您的预期。

举个例子，如果您计划处理一些重要的事情，请 **始终** 在响应之前验证 `sender`：

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

## 故障排除

- 不起作用？<br />
如果不需要 `window` 上下文，`webext-bridge` 则可以开箱即用地在 `devtools` <-> `background` <-> `content-script`(s) 之间进行消息传递。如果即使这样也不起作用，则很可能还 `webext-bridge` 没有加载到您的扩展程序的后台页面中，该页面被用作 `webext-bridge` 中继。如果您不需要自己的后台页面，至少需要以下代码才能让 `webext-bridge` 起作用。

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

- 无法发送消息至 `window`？<br />
从或向 `window` 发送或接收消息需要您在该特定选项卡的内容脚本中打开消息传递网关。该选项卡中的任何内容脚本调用 `allowWindowMessaging(<namespaceA: string>)` ，并调用 `setNamespace(<namespaceB: string>)` 加载到顶部框架（即 `window` 上下文）中的脚本。确保 `namespaceA === namespaceB`. 如果您这样做，请阅读[上面的安全说明](https://github.com/zikaari/webext-bridge/edit/main/README.md#security)
