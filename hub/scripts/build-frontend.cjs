// Vite uses the Node built-in crypto module and expects Web Crypto methods.
// Node 16's crypto module lacks getRandomValues; install the compatible
// implementation before loading Vite's ESM entrypoint.
const crypto = require('node:crypto')
if (typeof crypto.getRandomValues !== 'function') {
  crypto.getRandomValues = crypto.webcrypto.getRandomValues.bind(crypto.webcrypto)
}
if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
  globalThis.crypto = crypto.webcrypto
}
import('../node_modules/vite/bin/vite.js').catch(error => {
  console.error(error)
  process.exitCode = 1
})
