// Mock for serialize-error (CommonJS format)
module.exports = {
  serializeError: function(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }
    return error
  },
  NonError: class NonError extends Error {
    constructor(value) {
      super('Non-error value: ' + value)
      this.name = 'NonError'
    }
  },
}
