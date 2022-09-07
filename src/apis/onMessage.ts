import type { JsonValue } from 'type-fest'
import type {
  DataTypeKey,
  GetDataType,
  GetReturnType,
  OnMessageCallback,
} from '../types'
import { onMessageListeners } from '../internal'

export function onMessage<
  Data extends JsonValue,
  K extends DataTypeKey | string,
>(
  messageID: K,
  callback: OnMessageCallback<GetDataType<K, Data>, GetReturnType<K, any>>,
): () => void {
  onMessageListeners.set(messageID, callback)

  return () => onMessageListeners.delete(messageID)
}
