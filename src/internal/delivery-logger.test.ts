import { createDeliveryLogger } from './delivery-logger'
import type { DeliveryReceipt } from './delivery-logger'
import type { InternalMessage } from '../types'
import type { EndpointFingerprint } from './endpoint-fingerprint'

const createMockMessage = (transactionId: string): InternalMessage => ({
  origin: { context: 'background', tabId: 1 },
  destination: { context: 'content-script', tabId: 2 },
  transactionId,
  hops: [],
  messageID: 'msg-1',
  messageType: 'message',
  timestamp: Date.now(),
})

const createMockFingerprint = (id: string): EndpointFingerprint => `uid::${id}`

describe('createDeliveryLogger', () => {
  it('should create a logger with empty logs initially', () => {
    const logger = createDeliveryLogger()
    expect(logger.entries()).toEqual([])
  })

  it('should add a single receipt', () => {
    const logger = createDeliveryLogger()
    const receipt: DeliveryReceipt = {
      message: createMockMessage('tx-1'),
      to: createMockFingerprint('fp-1'),
      from: { endpointId: 'ep-1', fingerprint: createMockFingerprint('fp-2') },
    }

    logger.add(receipt)
    expect(logger.entries()).toEqual([receipt])
  })

  it('should add multiple receipts at once', () => {
    const logger = createDeliveryLogger()
    const receipt1: DeliveryReceipt = {
      message: createMockMessage('tx-1'),
      to: createMockFingerprint('fp-1'),
      from: { endpointId: 'ep-1', fingerprint: createMockFingerprint('fp-2') },
    }
    const receipt2: DeliveryReceipt = {
      message: createMockMessage('tx-2'),
      to: createMockFingerprint('fp-3'),
      from: { endpointId: 'ep-2', fingerprint: createMockFingerprint('fp-4') },
    }

    logger.add(receipt1, receipt2)
    expect(logger.entries()).toEqual([receipt1, receipt2])
  })

  it('should remove receipts by transactionId (string)', () => {
    const logger = createDeliveryLogger()
    const receipt1: DeliveryReceipt = {
      message: createMockMessage('tx-1'),
      to: createMockFingerprint('fp-1'),
      from: { endpointId: 'ep-1', fingerprint: createMockFingerprint('fp-2') },
    }
    const receipt2: DeliveryReceipt = {
      message: createMockMessage('tx-2'),
      to: createMockFingerprint('fp-3'),
      from: { endpointId: 'ep-2', fingerprint: createMockFingerprint('fp-4') },
    }

    logger.add(receipt1, receipt2)
    logger.remove('tx-1')
    expect(logger.entries()).toEqual([receipt2])
  })

  it('should remove receipts by array of receipts', () => {
    const logger = createDeliveryLogger()
    const receipt1: DeliveryReceipt = {
      message: createMockMessage('tx-1'),
      to: createMockFingerprint('fp-1'),
      from: { endpointId: 'ep-1', fingerprint: createMockFingerprint('fp-2') },
    }
    const receipt2: DeliveryReceipt = {
      message: createMockMessage('tx-2'),
      to: createMockFingerprint('fp-3'),
      from: { endpointId: 'ep-2', fingerprint: createMockFingerprint('fp-4') },
    }

    logger.add(receipt1, receipt2)
    logger.remove([receipt1])
    expect(logger.entries()).toEqual([receipt2])
  })

  it('should handle removing non-existent transactionId gracefully', () => {
    const logger = createDeliveryLogger()
    const receipt: DeliveryReceipt = {
      message: createMockMessage('tx-1'),
      to: createMockFingerprint('fp-1'),
      from: { endpointId: 'ep-1', fingerprint: createMockFingerprint('fp-2') },
    }

    logger.add(receipt)
    logger.remove('tx-nonexistent')
    expect(logger.entries()).toEqual([receipt])
  })

  it('should handle removing empty array gracefully', () => {
    const logger = createDeliveryLogger()
    const receipt: DeliveryReceipt = {
      message: createMockMessage('tx-1'),
      to: createMockFingerprint('fp-1'),
      from: { endpointId: 'ep-1', fingerprint: createMockFingerprint('fp-2') },
    }

    logger.add(receipt)
    logger.remove([])
    expect(logger.entries()).toEqual([receipt])
  })

  it('should allow multiple add operations', () => {
    const logger = createDeliveryLogger()
    const receipt1: DeliveryReceipt = {
      message: createMockMessage('tx-1'),
      to: createMockFingerprint('fp-1'),
      from: { endpointId: 'ep-1', fingerprint: createMockFingerprint('fp-2') },
    }
    const receipt2: DeliveryReceipt = {
      message: createMockMessage('tx-2'),
      to: createMockFingerprint('fp-3'),
      from: { endpointId: 'ep-2', fingerprint: createMockFingerprint('fp-4') },
    }

    logger.add(receipt1)
    logger.add(receipt2)
    expect(logger.entries()).toEqual([receipt1, receipt2])
  })

  it('should remove all receipts when all are passed in array', () => {
    const logger = createDeliveryLogger()
    const receipt1: DeliveryReceipt = {
      message: createMockMessage('tx-1'),
      to: createMockFingerprint('fp-1'),
      from: { endpointId: 'ep-1', fingerprint: createMockFingerprint('fp-2') },
    }
    const receipt2: DeliveryReceipt = {
      message: createMockMessage('tx-2'),
      to: createMockFingerprint('fp-3'),
      from: { endpointId: 'ep-2', fingerprint: createMockFingerprint('fp-4') },
    }

    logger.add(receipt1, receipt2)
    logger.remove([receipt1, receipt2])
    expect(logger.entries()).toEqual([])
  })
})
