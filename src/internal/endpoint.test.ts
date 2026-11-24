import { parseEndpoint, formatEndpoint } from './endpoint'

describe('parseEndpoint', () => {
  it('should parse background context', () => {
    const result = parseEndpoint('background')
    expect(result).toEqual({ context: 'background', tabId: NaN, frameId: undefined })
  })

  it('should parse devtools context', () => {
    const result = parseEndpoint('devtools@1')
    expect(result).toEqual({ context: 'devtools', tabId: 1, frameId: undefined })
  })

  it('should parse popup context', () => {
    const result = parseEndpoint('popup')
    expect(result).toEqual({ context: 'popup', tabId: NaN, frameId: undefined })
  })

  it('should parse options context', () => {
    const result = parseEndpoint('options')
    expect(result).toEqual({ context: 'options', tabId: NaN, frameId: undefined })
  })

  it('should parse content-script context with tabId', () => {
    const result = parseEndpoint('content-script@5')
    expect(result).toEqual({ context: 'content-script', tabId: 5, frameId: undefined })
  })

  it('should parse content-script context with tabId and frameId', () => {
    const result = parseEndpoint('content-script@5.2')
    expect(result).toEqual({ context: 'content-script', tabId: 5, frameId: 2 })
  })

  it('should parse window context with tabId and frameId', () => {
    const result = parseEndpoint('window@10.3')
    expect(result).toEqual({ context: 'window', tabId: 10, frameId: 3 })
  })

  it('should parse devtools context with tabId and frameId', () => {
    const result = parseEndpoint('devtools@7.1')
    expect(result).toEqual({ context: 'devtools', tabId: 7, frameId: 1 })
  })

  it('should not parse background with explicit tabId (returns undefined context)', () => {
    const result = parseEndpoint('background@1')
    expect(result.context).toBeUndefined()
    expect(result.tabId).toBeNaN()
    expect(result.frameId).toBeUndefined()
  })

  it('should not parse background with tabId and frameId (returns undefined context)', () => {
    const result = parseEndpoint('background@1.2')
    expect(result.context).toBeUndefined()
    expect(result.tabId).toBeNaN()
    expect(result.frameId).toBeUndefined()
  })

  it('should return NaN for tabId when not provided', () => {
    const result = parseEndpoint('popup')
    expect(result.tabId).toBeNaN()
  })

  it('should return undefined for frameId when not provided', () => {
    const result = parseEndpoint('devtools@5')
    expect(result.frameId).toBeUndefined()
  })
})

describe('formatEndpoint', () => {
  it('should format background context', () => {
    const result = formatEndpoint({ context: 'background', tabId: NaN })
    expect(result).toBe('background')
  })

  it('should format popup context', () => {
    const result = formatEndpoint({ context: 'popup', tabId: NaN })
    expect(result).toBe('popup')
  })

  it('should format options context', () => {
    const result = formatEndpoint({ context: 'options', tabId: NaN })
    expect(result).toBe('options')
  })

  it('should format devtools context with tabId', () => {
    const result = formatEndpoint({ context: 'devtools', tabId: 1 })
    expect(result).toBe('devtools@1')
  })

  it('should format content-script context with tabId', () => {
    const result = formatEndpoint({ context: 'content-script', tabId: 5 })
    expect(result).toBe('content-script@5')
  })

  it('should format content-script context with tabId and frameId', () => {
    const result = formatEndpoint({ context: 'content-script', tabId: 5, frameId: 2 })
    expect(result).toBe('content-script@5.2')
  })

  it('should format window context with tabId and frameId', () => {
    const result = formatEndpoint({ context: 'window', tabId: 10, frameId: 3 })
    expect(result).toBe('window@10.3')
  })

  it('should format devtools context with tabId and frameId', () => {
    const result = formatEndpoint({ context: 'devtools', tabId: 7, frameId: 1 })
    expect(result).toBe('devtools@7.1')
  })

  it('should ignore tabId and frameId for background context', () => {
    const result = formatEndpoint({ context: 'background', tabId: 1, frameId: 2 })
    expect(result).toBe('background')
  })

  it('should ignore tabId for background context', () => {
    const result = formatEndpoint({ context: 'background', tabId: 5 })
    expect(result).toBe('background')
  })

  it('should ignore tabId for popup context', () => {
    const result = formatEndpoint({ context: 'popup', tabId: 5 })
    expect(result).toBe('popup')
  })

  it('should ignore tabId for options context', () => {
    const result = formatEndpoint({ context: 'options', tabId: 5 })
    expect(result).toBe('options')
  })
})

describe('parseEndpoint and formatEndpoint roundtrip', () => {
  it('should roundtrip content-script with tabId and frameId', () => {
    const original = 'content-script@5.2'
    const parsed = parseEndpoint(original)
    const formatted = formatEndpoint(parsed)
    expect(formatted).toBe(original)
  })

  it('should roundtrip devtools with tabId', () => {
    const original = 'devtools@10'
    const parsed = parseEndpoint(original)
    const formatted = formatEndpoint(parsed)
    expect(formatted).toBe(original)
  })

  it('should roundtrip window with tabId and frameId', () => {
    const original = 'window@3.1'
    const parsed = parseEndpoint(original)
    const formatted = formatEndpoint(parsed)
    expect(formatted).toBe(original)
  })

  it('should roundtrip background', () => {
    const original = 'background'
    const parsed = parseEndpoint(original)
    const formatted = formatEndpoint(parsed)
    expect(formatted).toBe(original)
  })

  it('should roundtrip popup', () => {
    const original = 'popup'
    const parsed = parseEndpoint(original)
    const formatted = formatEndpoint(parsed)
    expect(formatted).toBe(original)
  })

  it('should roundtrip options', () => {
    const original = 'options'
    const parsed = parseEndpoint(original)
    const formatted = formatEndpoint(parsed)
    expect(formatted).toBe(original)
  })
})
