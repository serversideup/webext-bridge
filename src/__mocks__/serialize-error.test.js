const { serializeError, NonError } = require('./serialize-error')

describe('serialize-error mock', () => {
  describe('serializeError', () => {
    it('serializes an Error object with name, message, and stack', () => {
      const error = new Error('test message')
      error.name = 'TestError'

      const result = serializeError(error)

      expect(result).toEqual({
        name: 'TestError',
        message: 'test message',
        stack: expect.any(String),
      })
    })

    it('serializes a TypeError with correct name', () => {
      const error = new TypeError('type error message')

      const result = serializeError(error)

      expect(result).toEqual({
        name: 'TypeError',
        message: 'type error message',
        stack: expect.any(String),
      })
    })

    it('serializes a custom Error subclass', () => {
      class CustomError extends Error {
        constructor(message) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const error = new CustomError('custom message')
      const result = serializeError(error)

      expect(result).toEqual({
        name: 'CustomError',
        message: 'custom message',
        stack: expect.any(String),
      })
    })

    it('returns non-Error values unchanged', () => {
      expect(serializeError('string error')).toBe('string error')
      expect(serializeError(123)).toBe(123)
      expect(serializeError(null)).toBe(null)
      expect(serializeError(undefined)).toBe(undefined)
      expect(serializeError({ message: 'obj error' })).toEqual({ message: 'obj error' })
      expect(serializeError([1, 2, 3])).toEqual([1, 2, 3])
    })
  })

  describe('NonError', () => {
    it('is a class that extends Error', () => {
      const nonError = new NonError('test value')

      expect(nonError).toBeInstanceOf(Error)
      expect(nonError).toBeInstanceOf(NonError)
    })

    it('has name "NonError"', () => {
      const nonError = new NonError('test value')

      expect(nonError.name).toBe('NonError')
    })

    it('includes the passed value in the message', () => {
      const nonError = new NonError('test value')

      expect(nonError.message).toBe('Non-error value: test value')
    })

    it('has a stack trace', () => {
      const nonError = new NonError('test value')

      expect(nonError.stack).toBeDefined()
      expect(typeof nonError.stack).toBe('string')
    })

    it('handles different value types in message', () => {
      expect(new NonError(123).message).toBe('Non-error value: 123')
      expect(new NonError(null).message).toBe('Non-error value: null')
      expect(new NonError({ foo: 'bar' }).message).toBe("Non-error value: [object Object]")
    })
  })
})
