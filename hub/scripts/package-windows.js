const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const projectDir = path.resolve(__dirname, '..')
const distDir = path.join(projectDir, 'dist')
const frontendDir = path.join(distDir, 'frontend')

fs.rmSync(frontendDir, { recursive: true, force: true })
fs.cpSync(path.join(projectDir, 'build'), frontendDir, { recursive: true })

// Flashable NodeMCU Lua firmware must live on disk next to vtally.exe.
// Compiled .lc files are optional: init.lua can also boot raw .lua modules.
const sourceDir = path.resolve(projectDir, '../tally/src')
const firmwareDir = path.join(distDir, 'esp8266')
const modules = [
  'init.lua', 'my-app.lua', 'my-led.lua', 'my-log-buffer.lua',
  'my-log.lua', 'my-settings.lua', 'my-tally.lua', 'my-wifi.lua',
]
fs.rmSync(firmwareDir, { recursive: true, force: true })
fs.mkdirSync(firmwareDir, { recursive: true })
for (const file of modules) {
  const sourceFile = path.join(sourceDir, file)
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Required ESP8266 firmware is missing: ${sourceFile}`)
  }
  fs.copyFileSync(sourceFile, path.join(firmwareDir, file))
}
console.log(`Included ${modules.length} bootable ESP8266 Lua files at ${firmwareDir}`)

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['pkg', 'dist/server.js', '--targets', 'node16-win-x64', '--output', 'dist/vtally.exe'],
  { cwd: projectDir, stdio: 'inherit' },
)

if (result.error) {
  throw result.error
}
process.exit(result.status ?? 1)