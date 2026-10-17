const { app, Menu, nativeImage, shell, Tray } = require('electron')
const { spawn } = require('child_process')
const path = require('path')

const hubUrl = 'http://localhost:3000'
let tray
let hubProcess
let isQuitting = false

function getResourcePath(name) {
  return app.isPackaged
    ? path.join(process.resourcesPath, name)
    : path.join(__dirname, 'dist', name)
}

function quit() {
  isQuitting = true
  if (hubProcess && !hubProcess.killed) {
    hubProcess.kill()
  }
  app.quit()
}

app.whenReady().then(() => {
  tray = new Tray(nativeImage.createFromPath(getResourcePath('tray-icon.png')))
  tray.setToolTip('vTally')
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Open Hub',
      click: () => shell.openExternal(hubUrl),
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: quit,
    },
  ]))

  hubProcess = spawn(getResourcePath('vtally.exe'), ['--env=production'], {
    cwd: app.isPackaged ? process.resourcesPath : path.join(__dirname, 'dist'),
    windowsHide: true,
    stdio: 'ignore',
  })
  hubProcess.on('error', error => {
    console.error(`Could not start vTally Hub: ${error.message}`)
    app.quit()
  })
  hubProcess.on('exit', (code, signal) => {
    if (!isQuitting) {
      console.error(`vTally Hub exited unexpectedly (code: ${code}, signal: ${signal})`)
      app.quit()
    }
  })
})

app.on('window-all-closed', event => event.preventDefault())
app.on('before-quit', () => {
  isQuitting = true
  if (hubProcess && !hubProcess.killed) {
    hubProcess.kill()
  }
})