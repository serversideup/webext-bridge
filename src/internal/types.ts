import type { InternalMessage } from '../types'

export interface QueuedMessage {
  resolvedDestination: string
  message: InternalMessage
}
