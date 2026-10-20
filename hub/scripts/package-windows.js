const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const projectDir = path.resolve(__dirname, '..')
const distDir = path.join(projectDir, 'dist')
const frontendDir = path.join(distDir, 'frontend')

fs.rmSync(frontendDir, { recursive: true, force: true })
fs.cpSync(path.join(projectDir, 'build'), frontendDir, { recursive: true })

// Flashable NodeMCU Lua firmware must live on disk next to vtally.exe.
// Modules ship only as precompiled .lc (tally/out): loaded from .lua sources
// the ESP8266 can run out of memory while booting.
const compiledDir = path.resolve(projectDir, '../tally/out')
const firmwareDir = path.join(distDir, 'esp8266')
const modules = [
  'my-app', 'my-led', 'my-log-buffer', 'my-log',
  'my-settings', 'my-tally', 'my-wifi',
]
fs.rmSync(firmwareDir, { recursive: true, force: true })
fs.mkdirSync(firmwareDir, { recursive: true })

const initSource = path.join(compiledDir, 'init.lua')
if (!fs.existsSync(initSource)) throw new Error('Missing required ESP8266 init.lua: ' + initSource)
fs.copyFileSync(initSource, path.join(firmwareDir, 'init.lua'))
for (const name of modules) {
  const source = path.join(compiledDir, name + '.lc')
  if (!fs.existsSync(source)) {
    throw new Error('Required precompiled ESP8266 module is missing: ' + source + '. Run "make -C tally build".')
  }
  fs.copyFileSync(source, path.join(firmwareDir, name + '.lc'))
}
console.log('Bundled complete ESP8266 firmware: init.lua + precompiled .lc in ' + firmwareDir)

// nodemcu-tool depends on the native serialport bindings addon. pkg follows
// JS requires but needs a separate hint for dynamically resolved .node files.
const serialportBindings = path.join(projectDir, 'node_modules', '@serialport', 'bindings')
function findNativeAddons(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) return findNativeAddons(filename)
    return entry.isFile() && entry.name.endsWith('.node') ? [filename] : []
  })
}
const nativeAddons = findNativeAddons(serialportBindings)
if (!nativeAddons.length) {
  throw new Error('NodeMCU flasher requires serialport native bindings, but no .node addon was installed. Reinstall dependencies with Node 24 before building.')
}
console.log('Including native serialport addon(s): ' + nativeAddons.map(file => path.relative(projectDir, file)).join(', '))

const pkgArgs = [
  'dist/server.js', '--config', 'package.json', '--targets', 'node24-win-x64',
  '--output', 'dist/gc-tally.exe',
]
// The maintained pkg fork reads asset globs from package.json's pkg.assets;
// its CLI no longer supports the legacy --assets flag.
const pkgCli = require.resolve('@yao-pkg/pkg/lib-es5/bin.js')
const result = spawnSync(
  process.execPath,
  [pkgCli, ...pkgArgs],
  { cwd: projectDir, stdio: 'inherit' },
)

if (result.error) {
  throw result.error
}
process.exit(result.status ?? 1)