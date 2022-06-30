import { GetDataType, GetReturnType, OnMessageCallback, DataTypeKey } from '../types'
import { onMessageListeners } from '../internal'

export function onMessage<
  K extends DataTypeKey,
>(
  messageID: K,
  callback: OnMessageCallback<GetDataType<K>, GetReturnType<K>>,
): void {
  onMessageListeners.set(messageID, callback)
}
