import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('Companion manifest and npm package versions match and are not placeholders', () => {
    const manifest = JSON.parse(readFileSync(new URL('../companion/manifest.json', import.meta.url), 'utf8'))
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/)
    assert.notEqual(manifest.version, '0.0.0')
    assert.equal(manifest.version, pkg.version)
})
