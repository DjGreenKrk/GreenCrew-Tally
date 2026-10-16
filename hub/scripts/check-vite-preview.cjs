const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const path = require('node:path')

const port = 4179
const host = '127.0.0.1'
const base = `http://${host}:${port}`
const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const child = spawn(command, ['run', 'preview:frontend', '--', '--host', host, '--port', String(port), '--strictPort'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
  detached: process.platform !== 'win32',
})
let output = ''
child.stdout.on('data', chunk => { output += chunk.toString() })
child.stderr.on('data', chunk => { output += chunk.toString() })

const abort = new AbortController()
const watchdog = setTimeout(() => {
  abort.abort()
  console.error('Vite HTTP smoke exceeded 45 seconds')
  process.exitCode = 1
  stop()
}, 45000)

function stop() {
  clearTimeout(watchdog)
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    killer.unref()
  } else if (child.pid) {
    try { process.kill(-child.pid, 'SIGKILL') } catch {}
  }
  child.stdout.destroy()
  child.stderr.destroy()
  child.unref()
}

async function run() {
  const deadline = Date.now() + 20000
  while (true) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited early: ${output}`)
    try {
      const response = await fetch(base + '/', { signal: abort.signal })
      if (response.ok) break
    } catch (error) {
      if (abort.signal.aborted) throw error
    }
    if (Date.now() > deadline) throw new Error(`Vite preview did not start: ${output}`)
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  for (const route of ['/', '/config', '/flasher', '/tally/demo', '/tally/demo/log']) {
    const response = await fetch(base + route, { signal: abort.signal })
    assert.equal(response.status, 200, `HTTP status for ${route}`)
    const html = await response.text()
    assert.ok(html.includes('<div id="root"></div>'), `React root missing at ${route}`)
    assert.ok(html.includes('src="/assets/'), `Bundle missing at ${route}`)
  }
  console.log('Vite preview SPA routes smoke check passed')
}

run().catch(error => { console.error(error); process.exitCode = 1 }).finally(stop)
