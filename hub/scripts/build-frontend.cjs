// Vite 6 needs Web Crypto. Node 16 (used for the legacy pkg toolchain)
// does not expose globalThis.crypto by default.
const { webcrypto } = require('node:crypto')
if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
  globalThis.crypto = webcrypto
}
import('../node_modules/vite/bin/vite.js').catch(error => {
  console.error(error)
  process.exitCode = 1
})
