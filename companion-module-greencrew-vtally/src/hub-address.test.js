import test from 'node:test'
import assert from 'node:assert/strict'
import { hubUrl } from './hub-address.js'

test('localhost remains the default when no Hub IP was configured', () => {
    assert.equal(hubUrl({}), 'http://127.0.0.1:3000/api/companion/tally')
})

test('connects to a remote LAN Hub IP or hostname on the selected port', () => {
    assert.equal(hubUrl({ host: '192.168.88.10', port: 3000 }), 'http://192.168.88.10:3000/api/companion/tally')
    assert.equal(hubUrl({ host: 'vtally.local', port: 4000 }), 'http://vtally.local:4000/api/companion/tally')
    assert.equal(hubUrl({ host: '::1', port: 3000 }), 'http://[::1]:3000/api/companion/tally')
})

test('rejects URLs, embedded ports and invalid addresses before fetching', () => {
    for (const host of ['http://192.168.1.1', '192.168.1.1:9999', 'a/b', '', ' x y']) {
        assert.throws(() => hubUrl({ host, port: 3000 }))
    }
    for (const port of [0, -1, 65536, 'bad']) {
        assert.throws(() => hubUrl({ host: '127.0.0.1', port }))
    }
})
