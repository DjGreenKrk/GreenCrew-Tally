const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')

const port = 4179
const host = '127.0.0.1'
const base = `http://${host}:${port}`
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(command, ['--yes', 'vite@6', 'preview', '--host', host, '--port', String(port), '--strictPort'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'pipe',
  shell: process.platform === 'win32',
})
let output = ''
child.stdout.on('data', chunk => { output += chunk.toString() })
child.stderr.on('data', chunk => { output += chunk.toString() })

async function run() {
  const deadline = Date.now() + 30000
  while (true) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited early: ${output}`)
    try {
      const response = await fetch(base + '/')
      if (response.ok) break
    } catch {}
    if (Date.now() > deadline) throw new Error(`Vite preview did not start: ${output}`)
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  for (const route of ['/', '/config', '/flasher', '/tally/demo', '/tally/demo/log']) {
    const response = await fetch(base + route)
    assert.equal(response.status, 200, `HTTP status for ${route}`)
    const html = await response.text()
    assert.match(html, /<div id="root"><\/div>/, `React root missing at ${route}`)
    assert.match(html, /<script[^>]+src="\/assets\//, `Bundle missing at ${route}`)
  }
  console.log('Vite preview SPA routes smoke check passed')
}

run().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
})
