import type { JsonValue } from 'type-fest'
import uuid from 'tiny-uid'
import { serializeError } from 'serialize-error'
import type { DataTypeKey, Destination, GetDataType, GetReturnType, IBridgeMessage, IInternalMessage, OnMessageCallback, RuntimeContext } from '../types'
import { parseEndpoint } from './parse-endpoint'

export interface EndpointRuntime {
  sendMessage: <ReturnType extends JsonValue, K extends DataTypeKey = DataTypeKey>(
    messageID: K,
    data: GetDataType<K, JsonValue>,
    destination?: Destination,
  ) => Promise<GetReturnType<K, ReturnType>>
  onMessage: <Data extends JsonValue, K extends DataTypeKey = DataTypeKey>(
    messageID: K,
    callback: OnMessageCallback<GetDataType<K, Data>, GetReturnType<K, any>>
  ) => void
  /**
   * @internal
   */
  handleMessage: (message: IInternalMessage) => void
}

export const createEndpointRuntime = (thisContext: RuntimeContext, routeMessage: (msg: IInternalMessage) => void): EndpointRuntime => {
  const runtimeId = uuid()
  const openTransactions = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()
  const onMessageListeners = new Map<string, OnMessageCallback<JsonValue>>()

  const handleMessage = (message: IInternalMessage) => {
    if (message.destination.context === thisContext && !message.destination.frameId && !message.destination.tabId) {
      const { transactionId, messageID, messageType } = message

      const handleReply = () => {
        const transactionP = openTransactions.get(transactionId)
        if (transactionP) {
          const { err, data } = message
          if (err) {
            const dehydratedErr = err as Record<string, string>
            const errCtr = self[dehydratedErr.name] as any
            const hydratedErr = new (typeof errCtr === 'function' ? errCtr : Error)(dehydratedErr.message)

            // eslint-disable-next-line no-restricted-syntax
            for (const prop in dehydratedErr)
              hydratedErr[prop] = dehydratedErr[prop]

            transactionP.reject(hydratedErr)
          }
          else {
            transactionP.resolve(data)
          }
          openTransactions.delete(transactionId)
        }
      }

      const handleNewMessage = async() => {
        let reply: JsonValue | void
        let err: Error
        let noHandlerFoundError = false

        try {
          const cb = onMessageListeners.get(messageID)
          if (typeof cb === 'function') {
            // eslint-disable-next-line n/no-callback-literal
            reply = await cb({
              sender: message.origin,
              id: messageID,
              data: message.data,
              timestamp: message.timestamp,
            } as IBridgeMessage<JsonValue>)
          }
          else {
            noHandlerFoundError = true
            throw new Error(`[webext-bridge] No handler registered in '${thisContext}' to accept messages with id '${messageID}'`)
          }
        }
        catch (error) {
          err = error
        }
        finally {
          if (err) message.err = serializeError(err)

          handleMessage({
            ...message,
            messageType: 'reply',
            data: reply,
            origin: { context: thisContext, tabId: null },
            destination: message.origin,
            hops: [],
          })

          if (err && !noHandlerFoundError)
            // eslint-disable-next-line no-unsafe-finally
            throw reply
        }
      }

      switch (messageType) {
        case 'reply': return handleReply()
        case 'message': return handleNewMessage()
      }
    }

    message.hops.push(`${thisContext}::${runtimeId}`)

    return routeMessage(message)
  }

  return {
    handleMessage,
    sendMessage: (messageID, data, destination = 'background') => {
      const endpoint = typeof destination === 'string' ? parseEndpoint(destination) : destination
      const errFn = 'Bridge#sendMessage ->'

      if (!endpoint.context)
        throw new TypeError(`${errFn} Destination must be any one of known destinations`)

      return new Promise((resolve, reject) => {
        const payload: IInternalMessage = {
          messageID,
          data,
          destination: endpoint,
          messageType: 'message',
          transactionId: uuid(),
          origin: { context: thisContext, tabId: null },
          hops: [],
          timestamp: Date.now(),
        }

        openTransactions.set(payload.transactionId, { resolve, reject })

        try {
          handleMessage(payload)
        }
        catch (error) {
          openTransactions.delete(payload.transactionId)
          reject(error)
        }
      })
    },
    onMessage: (messageID, callback) => {
      onMessageListeners.set(messageID, callback)
    },
  }
}
