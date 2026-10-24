const { app, dialog, Menu, nativeImage, shell, Tray } = require('electron')
const { spawn } = require('child_process')
const http = require('http')
const path = require('path')

const hubPort = parseInt(process.env.PORT, 10) || 3000
const hubUrl = `http://localhost:${hubPort}`
// CI: start the Hub, wait until it answers, exit through the same path as the
// Exit menu item. No browser, no dialogs; the exit code tells the result.
const selfTest = process.env.GC_TALLY_TRAY_SELFTEST === '1'
const startupTimeoutMs = 30000

const texts = {
  pl: {
    open: 'Otwórz GC Tally',
    exit: 'Zakończ',
    title: 'GC Tally',
    notStarted: 'Nie udało się uruchomić Huba GC Tally.',
    stopped: 'Hub GC Tally niespodziewanie się zatrzymał.',
    timeout: `Hub GC Tally nie odpowiada na ${hubUrl}.`,
  },
  en: {
    open: 'Open GC Tally',
    exit: 'Exit',
    title: 'GC Tally',
    notStarted: 'The GC Tally Hub could not be started.',
    stopped: 'The GC Tally Hub stopped unexpectedly.',
    timeout: `The GC Tally Hub does not answer on ${hubUrl}.`,
  },
}
let t = texts.en

let tray
let hubProcess
let hubErrors = ''
let isQuitting = false
let failed = false

function getResourcePath(name) {
  return app.isPackaged
    ? path.join(process.resourcesPath, name)
    : path.join(__dirname, 'dist', name)
}

function stopHub() {
  if (hubProcess && hubProcess.exitCode === null && !hubProcess.killed) {
    hubProcess.kill()
  }
}

function quit(exitCode = 0) {
  isQuitting = true
  stopHub()
  if (exitCode === 0) {
    app.quit()
  } else {
    app.exit(exitCode)
  }
}

// The Hub explains startup problems (e.g. a busy port) between two banners.
function hubReason() {
  const match = hubErrors.match(/GC Tally Hub cannot start:\s*([\s\S]*?)\n=+/)
  if (match) return match[1].trim()
  return hubErrors.trim().split('\n').slice(-8).join('\n')
}

function fail(message) {
  if (failed) return
  failed = true
  const reason = hubReason()
  console.error(`${message}\n${reason}`)
  if (!selfTest) {
    dialog.showErrorBox(t.title, reason ? `${message}\n\n${reason}` : message)
  }
  quit(1)
}

// Asks the Hub's own API, so another program on the same port does not count.
function isHubAnswering() {
  return new Promise(resolve => {
    const request = http.get(`http://127.0.0.1:${hubPort}/api/companion/tally`, response => {
      let body = ''
      response.on('data', chunk => { body += chunk })
      response.on('end', () => {
        try {
          resolve(typeof JSON.parse(body).timeoutMs === 'number')
        } catch {
          resolve(false)
        }
      })
    })
    request.on('error', () => resolve(false))
    request.setTimeout(2000, () => request.destroy())
  })
}

async function whenHubReady() {
  const end = Date.now() + startupTimeoutMs
  while (Date.now() < end) {
    if (isQuitting || !hubProcess || hubProcess.exitCode !== null) return
    if (await isHubAnswering()) {
      if (selfTest) {
        console.log(`Hub answered on ${hubUrl}, exiting (self-test)`)
        quit(0)
      } else {
        shell.openExternal(hubUrl)
      }
      return
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  fail(t.timeout)
}

// A second start only opens the browser instead of a second Hub on a busy port.
if (!app.requestSingleInstanceLock()) {
  app.exit(0)
} else {
  app.on('second-instance', () => shell.openExternal(hubUrl))

  app.whenReady().then(() => {
    t = app.getLocale().startsWith('pl') ? texts.pl : texts.en

    tray = new Tray(nativeImage.createFromPath(getResourcePath('tray-icon.png')))
    tray.setToolTip(t.title)
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: t.open,
        click: () => shell.openExternal(hubUrl),
      },
      { type: 'separator' },
      {
        label: t.exit,
        click: () => quit(0),
      },
    ]))

    hubProcess = spawn(getResourcePath('gc-tally.exe'), ['--env=production'], {
      cwd: app.isPackaged ? process.resourcesPath : path.join(__dirname, 'dist'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // Only errors explain a failure; the normal log is not needed here.
    hubProcess.stdout.resume()
    hubProcess.stderr.on('data', chunk => {
      hubErrors = (hubErrors + chunk.toString()).slice(-8000)
    })
    hubProcess.on('error', error => {
      hubErrors += `\n${error.message}`
      fail(t.notStarted)
    })
    // 'close' comes after the output is read to the end, unlike 'exit'
    hubProcess.on('close', (code, signal) => {
      if (!isQuitting) {
        hubErrors += `\n(code: ${code}, signal: ${signal})`
        fail(t.stopped)
      }
    })

    whenHubReady()
  })

  app.on('window-all-closed', event => event.preventDefault())
  app.on('before-quit', () => {
    isQuitting = true
    stopHub()
  })
}
