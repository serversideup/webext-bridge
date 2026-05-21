import { isInternalEndpoint, parseEndpoint } from './index'

describe('isInternalEndpoint', () => {
  it('should return true for background context', () => {
    expect(isInternalEndpoint({ context: 'background', tabId: 1 })).toBe(true)
  })

  it('should return true for devtools context', () => {
    expect(isInternalEndpoint({ context: 'devtools', tabId: 1 })).toBe(true)
  })

  it('should return true for content-script context', () => {
    expect(isInternalEndpoint({ context: 'content-script', tabId: 1 })).toBe(true)
  })

  it('should return true for options context', () => {
    expect(isInternalEndpoint({ context: 'options', tabId: 1 })).toBe(true)
  })

  it('should return true for popup context', () => {
    expect(isInternalEndpoint({ context: 'popup', tabId: 1 })).toBe(true)
  })

  it('should return false for window context', () => {
    expect(isInternalEndpoint({ context: 'window', tabId: 1 })).toBe(false)
  })
})

describe('parseEndpoint', () => {
  it('should parse background endpoint', () => {
    expect(parseEndpoint('background')).toEqual({ context: 'background', tabId: NaN })
  })

  it('should parse devtools endpoint', () => {
    expect(parseEndpoint('devtools')).toEqual({ context: 'devtools', tabId: NaN })
  })

  it('should parse popup endpoint', () => {
    expect(parseEndpoint('popup')).toEqual({ context: 'popup', tabId: NaN })
  })

  it('should parse options endpoint', () => {
    expect(parseEndpoint('options')).toEqual({ context: 'options', tabId: NaN })
  })

  it('should parse window endpoint with tabId', () => {
    expect(parseEndpoint('window@1')).toEqual({ context: 'window', tabId: 1, frameId: undefined })
  })

  it('should parse window endpoint with tabId and frameId', () => {
    expect(parseEndpoint('window@1.2')).toEqual({ context: 'window', tabId: 1, frameId: 2 })
  })

  it('should parse content-script endpoint with tabId', () => {
    expect(parseEndpoint('content-script@5')).toEqual({ context: 'content-script', tabId: 5, frameId: undefined })
  })

  it('should parse content-script endpoint with tabId and frameId', () => {
    expect(parseEndpoint('content-script@5.10')).toEqual({ context: 'content-script', tabId: 5, frameId: 10 })
  })

  it('should parse devtools endpoint with tabId', () => {
    expect(parseEndpoint('devtools@3')).toEqual({ context: 'devtools', tabId: 3, frameId: undefined })
  })
})
