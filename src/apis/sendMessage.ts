import { JsonValue } from 'type-fest'
import uuid from 'tiny-uid'
import { IInternalMessage, Destination, GetDataType, DataTypeKey, GetReturnType } from '../types'
import { context, openTransactions, routeMessage } from '../internal'
import { parseEndpoint } from '../utils'

/**
 * Sends a message to some other endpoint, to which only one listener can send response.
 * Returns Promise. Use `then` or `await` to wait for the response.
 * If destination is `window` message will routed using window.postMessage.
 * Which requires a shared namespace to be set between `content-script` and `window`
 * that way they can recognize each other when global window.postMessage happens and there are other
 * extensions using webext-bridge as well
 * @param messageID
 * @param data
 * @param destination default 'background'
 */
export async function sendMessage<
  ReturnType extends JsonValue,
  K extends DataTypeKey | string
>(
  messageID: K,
  data: GetDataType<K, JsonValue>,
  destination: Destination = 'background',
) {
  const endpoint = typeof destination === 'string' ? parseEndpoint(destination) : destination
  const errFn = 'Bridge#sendMessage ->'

  if (!endpoint.context)
    throw new TypeError(`${errFn} Destination must be any one of known destinations`)

  if (context === 'background') {
    const { context: dest, tabId: destTabId } = endpoint
    if (dest !== 'background' && !destTabId)
      throw new TypeError(`${errFn} When sending messages from background page, use @tabId syntax to target specific tab`)
  }

  return new Promise<GetReturnType<K, ReturnType>>((resolve, reject) => {
    const payload: IInternalMessage = {
      messageID,
      data,
      destination: endpoint,
      messageType: 'message',
      transactionId: uuid(),
      origin: { context, tabId: null },
      hops: [],
      timestamp: Date.now(),
    }

    openTransactions.set(payload.transactionId, { resolve, reject })
    routeMessage(payload)
  })
}
