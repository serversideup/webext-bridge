import { isInternalEndpoint } from './is-internal-endpoint'
import type { Endpoint } from '../types'

const createEndpoint = (context: Endpoint['context']): Endpoint => ({
  context,
  tabId: 1,
})

describe('isInternalEndpoint', () => {
  it('should return true for background context', () => {
    const endpoint = createEndpoint('background')
    expect(isInternalEndpoint(endpoint)).toBe(true)
  })

  it('should return true for devtools context', () => {
    const endpoint = createEndpoint('devtools')
    expect(isInternalEndpoint(endpoint)).toBe(true)
  })

  it('should return true for content-script context', () => {
    const endpoint = createEndpoint('content-script')
    expect(isInternalEndpoint(endpoint)).toBe(true)
  })

  it('should return true for options context', () => {
    const endpoint = createEndpoint('options')
    expect(isInternalEndpoint(endpoint)).toBe(true)
  })

  it('should return true for popup context', () => {
    const endpoint = createEndpoint('popup')
    expect(isInternalEndpoint(endpoint)).toBe(true)
  })

  it('should return false for window context', () => {
    const endpoint = createEndpoint('window')
    expect(isInternalEndpoint(endpoint)).toBe(false)
  })
})
