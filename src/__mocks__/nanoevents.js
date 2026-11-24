// Mock for nanoevents (CommonJS format)
module.exports = {
  createNanoEvents: function() {
    return {
      on: function(event, cb) {
        return function() {}
      },
      emit: function(event) {
        // no-op
      },
    }
  },
}
