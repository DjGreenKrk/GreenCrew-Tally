const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const output = path.resolve(__dirname, '..', 'build')
const htmlPath = path.join(output, 'index.html')
assert.ok(fs.existsSync(htmlPath), 'Vite did not emit build/index.html')
const html = fs.readFileSync(htmlPath, 'utf8')
assert.match(html, /<div id="root"><\/div>/, 'React mount point is missing')
assert.doesNotMatch(html, /%PUBLIC_URL%/, 'CRA placeholders leaked into Vite output')
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1])
assert.ok(scripts.length > 0, 'No frontend JavaScript bundle was emitted')
for (const url of scripts) {
  assert.ok(url.startsWith('/'), `Unexpected script URL: ${url}`)
  assert.ok(fs.existsSync(path.join(output, url.slice(1))), `Missing bundle: ${url}`)
}
console.log('Vite frontend output smoke check passed')
