import { createFingerprint } from './endpoint-fingerprint'

describe('endpoint-fingerprint', () => {
  describe('createFingerprint', () => {
    it('should return a string with uid:: prefix', () => {
      const result = createFingerprint()
      expect(result).toMatch(/^uid::/)
    })

    it('should return a string of correct length (uid:: = 5 chars + 7 char uid = 12 total)', () => {
      const result = createFingerprint()
      expect(result.length).toBe(12)
    })

    it('should return unique values on each call', () => {
      const results = new Set([createFingerprint(), createFingerprint(), createFingerprint()])
      expect(results.size).toBe(3)
    })

    it('should return a valid EndpointFingerprint type', () => {
      const result = createFingerprint()
      expect(typeof result).toBe('string')
    })
  })
})
