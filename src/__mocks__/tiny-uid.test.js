const uid = require('./tiny-uid')

describe('tiny-uid mock', () => {
  it('should be a function', () => {
    expect(typeof uid).toBe('function')
  })

  it('should return a string', () => {
    const result = uid()
    expect(typeof result).toBe('string')
  })

  it('should return a 7 character string', () => {
    const result = uid()
    expect(result.length).toBe(7)
  })

  it('should return different values on each call', () => {
    const results = new Set()
    for (let i = 0; i < 100; i++) {
      results.add(uid())
    }
    expect(results.size).toBeGreaterThan(1)
  })

  it('should only contain valid base36 characters (alphanumeric lowercase)', () => {
    const result = uid()
    expect(/^[a-z0-9]+$/.test(result)).toBe(true)
  })
})
