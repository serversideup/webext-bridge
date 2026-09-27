import type { EndpointFingerprint } from './endpoint-fingerprint'
import { encodeConnectionArgs, decodeConnectionArgs } from './connection-args'

describe('connection-args', () => {
  describe('encodeConnectionArgs', () => {
    it('should encode valid connection args to JSON string', () => {
      const args = {
        endpointName: 'test-endpoint',
        fingerprint: 'uid::abc123' as EndpointFingerprint,
      }
      const result = encodeConnectionArgs(args)
      expect(result).toBe(JSON.stringify(args))
    })

    it('should throw TypeError for null input', () => {
      expect(() => encodeConnectionArgs(null as any)).toThrow(TypeError)
    })

    it('should throw TypeError for undefined input', () => {
      expect(() => encodeConnectionArgs(undefined as any)).toThrow(TypeError)
    })

    it('should throw TypeError for non-object input', () => {
      expect(() => encodeConnectionArgs('string' as any)).toThrow(TypeError)
      expect(() => encodeConnectionArgs(123 as any)).toThrow(TypeError)
    })

    it('should throw TypeError for object missing endpointName', () => {
      const args = { fingerprint: 'uid::abc123' as EndpointFingerprint }
      expect(() => encodeConnectionArgs(args as any)).toThrow(TypeError)
    })

    it('should throw TypeError for object missing fingerprint', () => {
      const args = { endpointName: 'test' }
      expect(() => encodeConnectionArgs(args as any)).toThrow(TypeError)
    })

    it('should throw TypeError for empty object', () => {
      expect(() => encodeConnectionArgs({} as any)).toThrow(TypeError)
    })
  })

  describe('decodeConnectionArgs', () => {
    it('should decode valid JSON string to connection args', () => {
      const args = {
        endpointName: 'test-endpoint',
        fingerprint: 'uid::abc123' as EndpointFingerprint,
      }
      const encoded = JSON.stringify(args)
      const result = decodeConnectionArgs(encoded)
      expect(result).toEqual(args)
    })

    it('should return null for invalid JSON string', () => {
      const result = decodeConnectionArgs('invalid-json')
      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = decodeConnectionArgs('')
      expect(result).toBeNull()
    })

    it('should return null for JSON missing endpointName', () => {
      const encoded = JSON.stringify({ fingerprint: 'uid::abc123' })
      const result = decodeConnectionArgs(encoded)
      expect(result).toBeNull()
    })

    it('should return null for JSON missing fingerprint', () => {
      const encoded = JSON.stringify({ endpointName: 'test' })
      const result = decodeConnectionArgs(encoded)
      expect(result).toBeNull()
    })

    it('should return null for empty JSON object', () => {
      const encoded = JSON.stringify({})
      const result = decodeConnectionArgs(encoded)
      expect(result).toBeNull()
    })

    it('should return null for JSON array', () => {
      const encoded = JSON.stringify([1, 2, 3])
      const result = decodeConnectionArgs(encoded)
      expect(result).toBeNull()
    })

    it('should return null for JSON primitive', () => {
      expect(decodeConnectionArgs('"string"')).toBeNull()
      expect(decodeConnectionArgs('123')).toBeNull()
      expect(decodeConnectionArgs('true')).toBeNull()
      expect(decodeConnectionArgs('null')).toBeNull()
    })
  })
})
