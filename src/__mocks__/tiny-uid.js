// Mock for tiny-uid (CommonJS format)
// Returns a 7 character string to match the expected fingerprint length
module.exports = function uid() {
  return Math.random().toString(36).substring(2, 9)
}
