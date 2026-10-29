// set NODE_ENV from argument to enable portability to windows
import { parseArgs } from 'util'

import TallyContainer from './tally/TallyContainer'
import UdpTallyDriver from './tally/UdpTallyDriver'
import { AppConfiguration } from './lib/AppConfiguration'
import { MixerDriver } from './lib/MixerDriver'
import express from 'express'
import path from 'path'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { Server } from 'http'
import { Server as SocketIoServer, Socket } from 'socket.io'

import { SocketAwareEvent } from './lib/SocketAwareEvent'
import ServerEventEmitter from './lib/ServerEventEmitter'
import { ServerSideSocket } from './lib/SocketEvents'
import AppConfigurationPersistence from './lib/AppConfigurationPersistence'
import AtemConfiguration from './mixer/atem/AtemConfiguration'
import VmixConfiguration from './mixer/vmix/VmixConfiguration'
import ObsConfiguration from './mixer/obs/ObsConfiguration'
import RolandV8HDConfiguration from './mixer/rolandV8HD/RolandV8HDConfiguration'
import RolandV60HDConfiguration from './mixer/rolandV60HD/RolandV60HDConfiguration'
import MockConfiguration from './mixer/mock/MockConfiguration'
import ManualConfiguration from './mixer/manual/ManualConfiguration'
import CompanionConfiguration from './mixer/companion/CompanionConfiguration'
import ManualConnector from './mixer/manual/ManualConnector'
import { isManualChannelState } from './mixer/manual/ManualState'
import TestConnector from './mixer/test/TestConnector'
import TestConfiguration from './mixer/test/TestConfiguration'
import WebTallyDriver from './tally/WebTallyDriver'
import { DefaultTallyConfiguration, TallyConfiguration } from './tally/TallyConfiguration'
import NodeMcuConnector from './flasher/NodeMcuConnector'
import VmixProjectManager from './lib/VmixProjectManager'
import registerCompanionApi, { isLoopbackAddress } from './mixer/companion/CompanionApi'
import { companionLanState, effectiveCompanionToken, generateCompanionToken, hubLanAddresses } from './mixer/companion/CompanionLanAccess'
import { describeListenError, exitWithStartupError } from './lib/startupFailure'
import HubAnnouncer from './lib/HubAnnouncer'
import DeviceRegistry from './tally/DeviceRegistry'
import DeviceBrowser from './tally/DeviceBrowser'
import { DeviceListState } from './tally/DeviceList'
import { isCrewPassword } from './tally/ManagementMessages'

const { values: argv } = parseArgs({
  options: {
    env: { type: 'string' },
    'with-test': { type: 'boolean' },
  },
  // ignore unknown flags instead of refusing to start
  strict: false,
})
if (argv.env !== undefined) {
  // @TODO: setting the env is not nice, but the easiest way to be cross-platform compatible
  // @see https://github.com/wifi-tally/wifi-tally/issues/18
  process.env.NODE_ENV = String(argv.env)
} else if ((process as NodeJS.Process & { pkg?: unknown }).pkg) {
  // A pkg-built EXE contains its own frontend, not the React dev server.
  // Default to production so launching gc-tally.exe directly does not proxy to :3001.
  // Assign through Object.assign to preserve runtime behavior without writing
  // directly to the readonly NODE_ENV declaration in the TypeScript types.
  Object.assign(process.env, { NODE_ENV: 'production' })
}
if (argv['with-test'] !== undefined) {
  process.env.HUB_WITH_TEST = "true"
}
const app = express()
const server = new Server(app)
const io = new SocketIoServer(server)

const myEmitter = new ServerEventEmitter()
myEmitter.setMaxListeners(99)
const myConfiguration = new AppConfiguration(myEmitter)
if (myConfiguration.isTest()) {
  console.log("Starting test environment")
  myConfiguration.setMixerSelection(TestConnector.ID)
  myConfiguration.setTallyTimeoutMissing(1000)
  myConfiguration.setTallyTimeoutDisconnected(3000)
} else {
  new AppConfigurationPersistence(myConfiguration, myEmitter)
}

const myTallyContainer = new TallyContainer(myConfiguration, myEmitter)
const myUdpTallyDriver = new UdpTallyDriver(myConfiguration, myTallyContainer, error => {
  exitWithStartupError(describeListenError(error, 'tally (UDP)', myConfiguration.getTallyPort()))
})
// Firmware v2 tallies by device id: the list on the Configuration page,
// pairing and the crew password (#28)
const myDeviceRegistry = new DeviceRegistry(myConfiguration,
  (text, address, port) => myUdpTallyDriver.sendManagement(text, address, port),
  state => myEmitter.emit('devices.changed', state))
myUdpTallyDriver.registry = myDeviceRegistry
setInterval(() => myDeviceRegistry.tick(), 500)
const myDeviceBrowser = new DeviceBrowser(myDeviceRegistry)
const myWebTallyDriver = new WebTallyDriver(myConfiguration, myTallyContainer)

// Firmware v2 tallies find the Hub over mDNS (#28). GC_TALLY_MDNS=off turns
// it off; the test environment only announces with GC_TALLY_MDNS=on.
const myHubAnnouncer = new HubAnnouncer(state => myEmitter.emit('discovery.changed', state))
const mdnsSetting = process.env.GC_TALLY_MDNS
if (mdnsSetting === 'off' || (myConfiguration.isTest() && mdnsSetting !== 'on')) {
  myHubAnnouncer.disable(myConfiguration.getHubId(), myConfiguration.getTallyPort())
} else {
  myHubAnnouncer.start(myConfiguration.getHubId(), myConfiguration.getTallyPort())
  myDeviceBrowser.start()
}
// say goodbye on the network, so tallies do not keep a stale Hub
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    setTimeout(() => process.exit(0), 500).unref()
    myDeviceBrowser.stop()
    myHubAnnouncer.stop(() => process.exit(0))
  })
}

const myMixerDriver = new MixerDriver(myConfiguration, myEmitter)
const myVmixProjectManager = new VmixProjectManager(myConfiguration, myTallyContainer, myEmitter)

// Register before the frontend catch-all / development proxy routes.
registerCompanionApi(app, myMixerDriver,
  () => effectiveCompanionToken(process.env.VTALLY_COMPANION_TOKEN, myConfiguration.getCompanionLanToken()).token)

const myNodeMcuConnector = new NodeMcuConnector()

// log stuff
myEmitter.on('tally.logged', ({tally, log}) => {
    let fn = console.info
    if(log.isError()) { 
      fn = console.error 
    } else if(log.isWarning()) {
      fn = console.warn
    }
    fn(`${tally.name}: ${log.message}`)
})
myEmitter.on('program.changed', ({programs, previews, auxes}) => {
    console.info("Program/Preview/AUX was changed to ", programs, previews, auxes)
})

// socket.io server
io.on('connection', (socket: ServerSideSocket) => {
  (socket as Socket).setMaxListeners(99)
  const mixerEvents = [
    // @TODO: use event objects instead of repeating the same structure again and again
    new SocketAwareEvent(myEmitter, 'mixer.connected', socket, (socket) => {
      socket.emit('mixer.state', {
        isConnected: true
      })
    }),
    new SocketAwareEvent(myEmitter, 'mixer.disconnected', socket, (socket) => {
      socket.emit('mixer.state', {
        isConnected: false
      })
    }),
  ]
  socket.on('events.mixer.subscribe', () => {
    mixerEvents.forEach(pipe => pipe.register())
    socket.emit('mixer.state', {
      isConnected: myMixerDriver.isConnected()
    })
  })
  socket.on('events.mixer.unsubscribe', () => {
    // @TODO: not used yet
    mixerEvents.forEach(pipe => pipe.unregister())
  })
  // Manually restart the current mixer connection, e.g. after a vMix/OBS
  // connector gave up retrying on its own (#4).
  socket.on('mixer.reconnect', () => {
    void myMixerDriver.reconnect()
  })

  const programEvents = [
    new SocketAwareEvent(myEmitter, 'program.changed', socket, (socket, {programs, previews, auxes}) => {
      socket.emit('program.state', {
        programs: programs,
        previews: previews,
        auxes: auxes,
      })
    })
  ]
  socket.on('events.program.subscribe', () => {
    programEvents.forEach(pipe => pipe.register())

    socket.emit('program.state', {
      programs: myMixerDriver.getCurrentPrograms(),
      previews: myMixerDriver.getCurrentPreviews(),
      auxes: myMixerDriver.getCurrentAuxes(),
    })
  })
  socket.on('events.program.unsubscribe', () => {
    // @TODO: not used yet
    programEvents.forEach(pipe => pipe.unregister())
  })

  const configEvents = [
    new SocketAwareEvent(myEmitter, 'config.changed.atem', socket, (socket, atemConfiguration) => {
      socket.emit('config.state.atem', atemConfiguration.toJson())
    }),
    new SocketAwareEvent(myEmitter, 'config.changed.mock', socket, (socket, mockConfiguration) => {
      socket.emit('config.state.mock', mockConfiguration.toJson())
    }),
    new SocketAwareEvent(myEmitter, 'config.changed.manual', socket, (socket, manualConfiguration) => {
      socket.emit('config.state.manual', manualConfiguration.toJson())
    }),
    new SocketAwareEvent(myEmitter, 'config.changed.companion', socket, (socket, companionConfiguration) => {
      socket.emit('config.state.companion', companionConfiguration.toJson())
    }),
    new SocketAwareEvent(myEmitter, 'config.changed.obs', socket, (socket, obsConfiguration) => {
      socket.emit('config.state.obs', obsConfiguration.toJson())
    }),
    new SocketAwareEvent(myEmitter, 'config.changed.vmix', socket, (socket, vmixConfiguration) => {
      socket.emit('config.state.vmix', vmixConfiguration.toJson())
    }),
    new SocketAwareEvent(myEmitter, 'config.changed.tallyconfig', socket, (socket, tallyConfiguration) => {
      socket.emit('config.state.tallyconfig', tallyConfiguration.toJson())
    }),
    new SocketAwareEvent(myEmitter, 'config.changed.mixer', socket, (socket, mixerName) => {
      socket.emit('config.state.mixer', {mixerName, allowedMixers: MixerDriver.getAllowedMixers(myConfiguration.isDev(), myConfiguration.isTest())})
    }),
  ]
  socket.on('events.config.subscribe', () => {
    configEvents.forEach(pipe => pipe.register())

    socket.emit('config.state.atem', myConfiguration.getAtemConfiguration().toJson())
    socket.emit('config.state.mixer', {mixerName: myConfiguration.getMixerSelection() || "", allowedMixers: MixerDriver.getAllowedMixers(myConfiguration.isDev(), myConfiguration.isTest())})
    socket.emit('config.state.mock', myConfiguration.getMockConfiguration().toJson())
    socket.emit('config.state.manual', myConfiguration.getManualConfiguration().toJson())
    socket.emit('config.state.companion', myConfiguration.getCompanionConfiguration().toJson())
    socket.emit('config.state.obs', myConfiguration.getObsConfiguration().toJson())
    socket.emit('config.state.rolandV8HD', myConfiguration.getRolandV8HDConfiguration().toJson())
    socket.emit('config.state.rolandV60HD', myConfiguration.getRolandV60HDConfiguration().toJson())
    socket.emit('config.state.vmix', myConfiguration.getVmixConfiguration().toJson())
    socket.emit('config.state.tallyconfig', myConfiguration.getTallyConfiguration().toJson())
  })
  socket.on('events.program.unsubscribe', () => {
    // @TODO: not used yet
    configEvents.forEach(pipe => pipe.unregister())
  })

  const tallyEvents = [
    new SocketAwareEvent(myEmitter, 'tally.changed', socket, (socket) => {
      socket.emit('tally.state', {tallies: myTallyContainer.getTalliesAsJson()})
    }),
    new SocketAwareEvent(myEmitter, 'tally.removed', socket, (socket) => {
      socket.emit('tally.state', {tallies: myTallyContainer.getTalliesAsJson()})
    }),
  ]
  socket.on('events.tally.subscribe', () => {
    tallyEvents.forEach(pipe => pipe.register())

    socket.emit('tally.state', {tallies: myTallyContainer.getTalliesAsJson()})
  })
  socket.on('events.tally.unsubscribe', () => {
    // @TODO: not used yet
    tallyEvents.forEach(pipe => pipe.unregister())
  })
  
  socket.on('tally.patch', (tallyName, tallyType, channelIds) => {
    myTallyContainer.patch(tallyName, tallyType, channelIds)
  })
  socket.on('tally.highlight', (tallyName, tallyType) => {
    myTallyContainer.highlight(tallyName, tallyType)
  })
  socket.on('tally.remove', (tallyName, tallyType) => {
    myTallyContainer.remove(tallyName, tallyType)
  })
  socket.on('tally.create', (tallyName, channelIds) => {
    myWebTallyDriver.create(tallyName, channelIds)
  })
  socket.on('tally.settings', (tallyName, tallyType, settings) => {
    const configuration = new TallyConfiguration()
    configuration.fromJson(settings)
    myTallyContainer.updateSettings(tallyName, tallyType, configuration)
  })
  socket.on('events.webTally.subscribe', tallyName => myWebTallyDriver.subscribe(tallyName, socket))
  socket.on('events.webTally.unsubscribe', tallyName => myWebTallyDriver.unsubscribe(tallyName, socket))

  const tallyLogEvents = [
    new SocketAwareEvent(myEmitter, 'tally.logged', socket, (socket, {tally, log}) => {
      socket.emit('tally.log', {tallyId: tally.getId(), log: log.toJson()})
    }),
  ]
  socket.on('events.tallyLog.subscribe', () => {
    tallyLogEvents.forEach(pipe => pipe.register())

    const logs = myTallyContainer.getTallies().map(tally => {
      return {
        tallyId: tally.getId(),
        logs: tally.getLogs().map(log => log.toJson())
      }
    })

    socket.emit('tally.log.state', logs)
  })
  socket.on('events.tallyLog.unsubscribe', () => {
    // @TODO: not used yet
    tallyLogEvents.forEach(pipe => pipe.unregister())
  })

  const channelEvents = [
    new SocketAwareEvent(myEmitter, 'config.changed.channels', socket, (socket, channels) => {
      socket.emit('channel.state', {channels: channels.map(channel => channel.toJson())})
    }),
  ]
  socket.on('events.channel.subscribe', () => {
    channelEvents.forEach(pipe => pipe.register())

    socket.emit('channel.state', {channels: myConfiguration.getChannelsAsJson()})
  })
  socket.on('events.channel.unsubscribe', () => {
    // @TODO: not used yet
    channelEvents.forEach(pipe => pipe.unregister())
  })

  const vmixProjectEvents = [
    new SocketAwareEvent(myEmitter, 'vmix.project.state.changed', socket, (socket, state) => {
      socket.emit('vmix.project.state', state)
    }),
  ]
  socket.on('events.vmixProject.subscribe', () => {
    vmixProjectEvents.forEach(pipe => pipe.register())
    socket.emit('vmix.project.state', myVmixProjectManager.getState())
  })
  socket.on('events.vmixProject.unsubscribe', () => {
    vmixProjectEvents.forEach(pipe => pipe.unregister())
  })
  socket.on('vmix.project.save', () => {
    myVmixProjectManager.saveCurrentProject()
  })


  socket.on('config.change.atem', (newAtemConfiguration, newMixerName) => {
    const atem = new AtemConfiguration()
    atem.fromJson(newAtemConfiguration)
    myConfiguration.setAtemConfiguration(atem)

    if (newMixerName) {
      myConfiguration.setMixerSelection(newMixerName)
    }
  })
  socket.on('config.change.mock', (newMockConfiguration, newMixerName) => {
    const mock = new MockConfiguration()
    mock.fromJson(newMockConfiguration)
    myConfiguration.setMockConfiguration(mock)

    if (newMixerName) {
      myConfiguration.setMixerSelection(newMixerName)
    }
  })
  socket.on('config.change.null', newMixerName => {
    if (newMixerName) {
      myConfiguration.setMixerSelection(newMixerName)
    }
  })
  socket.on('config.change.manual', (newManualConfiguration, newMixerName) => {
    const manual = new ManualConfiguration()
    manual.fromJson(newManualConfiguration)
    myConfiguration.setManualConfiguration(manual)

    if (newMixerName) {
      myConfiguration.setMixerSelection(newMixerName)
    }
  })
  // the manual control page; ignored while another mixer is selected
  socket.on('manual.set', (channelId, state) => {
    const mixer = myMixerDriver.currentMixerInstance
    if (mixer instanceof ManualConnector && typeof channelId === 'string' && isManualChannelState(state)) {
      try {
        mixer.setChannelState(channelId, state)
      } catch (err) {
        console.warn(`Manual control: ${err}`)
      }
    }
  })
  socket.on('manual.allOff', () => {
    const mixer = myMixerDriver.currentMixerInstance
    if (mixer instanceof ManualConnector) mixer.allOff()
  })
  socket.on('config.change.companion', (newCompanionConfiguration, newMixerName) => {
    const companion = new CompanionConfiguration()
    companion.fromJson(newCompanionConfiguration)
    myConfiguration.setCompanionConfiguration(companion)

    if (newMixerName) {
      myConfiguration.setMixerSelection(newMixerName)
    }
  })
  // The LAN token is shown and changed only from a browser on the Hub computer.
  const isHubComputer = isLoopbackAddress((socket as Socket).handshake.address)
  const sendCompanionLanState = () => socket.emit('companion.lan.state', companionLanState(
    process.env.VTALLY_COMPANION_TOKEN, myConfiguration.getCompanionLanToken(),
    isHubComputer, myConfiguration.getHttpPort(), hubLanAddresses()))
  const companionLanEvent = new SocketAwareEvent(myEmitter, 'config.changed.companionLan', socket, sendCompanionLanState)
  socket.on('companion.lan.get', () => {
    companionLanEvent.register()
    sendCompanionLanState()
  })
  const discoveryEvent = new SocketAwareEvent(myEmitter, 'discovery.changed', socket, (socket, state) => {
    socket.emit('discovery.state', state)
  })
  socket.on('discovery.get', () => {
    discoveryEvent.register()
    socket.emit('discovery.state', myHubAnnouncer.getState())
  })
  const sendDevices = (state: Omit<DeviceListState, 'canChangeCrewPassword'>) =>
    socket.emit('devices.state', { ...state, canChangeCrewPassword: isHubComputer })
  const devicesEvent = new SocketAwareEvent(myEmitter, 'devices.changed', socket, (_socket, state) => sendDevices(state))
  socket.on('devices.get', () => {
    devicesEvent.register()
    sendDevices(myDeviceRegistry.getState())
  })
  socket.on('device.identify', id => { if (typeof id === 'string') myDeviceRegistry.identify(id) })
  socket.on('device.pair', id => { if (typeof id === 'string') myDeviceRegistry.pair(id) })
  socket.on('device.unpair', id => { if (typeof id === 'string') myDeviceRegistry.unpair(id) })
  socket.on('device.forget', id => { if (typeof id === 'string') myDeviceRegistry.forget(id) })
  // like the Companion token: a secret, so only on the Hub computer
  socket.on('crewPassword.set', password => {
    if (!isHubComputer || typeof password !== 'string') return
    if (password === '' || isCrewPassword(password)) myConfiguration.setCrewPassword(password)
  })
  socket.on('companion.lan.generate', () => {
    if (isHubComputer && !process.env.VTALLY_COMPANION_TOKEN) myConfiguration.setCompanionLanToken(generateCompanionToken())
  })
  socket.on('companion.lan.disable', () => {
    if (isHubComputer && !process.env.VTALLY_COMPANION_TOKEN) myConfiguration.setCompanionLanToken(undefined)
  })
  socket.on('config.change.obs', (newObsConfiguration, newMixerName) => {
    const obs = new ObsConfiguration()
    obs.fromJson(newObsConfiguration)
    myConfiguration.setObsConfiguration(obs)

    if (newMixerName) {
      myConfiguration.setMixerSelection(newMixerName)
    }
  })
  socket.on('config.change.rolandV8HD', (newRolandV8HDConfiguration, newMixerName) => {
    const rolandV8HD = new RolandV8HDConfiguration()
    rolandV8HD.fromJson(newRolandV8HDConfiguration)
    myConfiguration.setRolandV8HDConfiguration(rolandV8HD)

    if (newMixerName) {
      myConfiguration.setMixerSelection(newMixerName)
    }
  })
  socket.on('config.change.rolandV60HD', (newRolandV60HDConfiguration, newMixerName) => {
    const rolandV60HD = new RolandV60HDConfiguration()
    rolandV60HD.fromJson(newRolandV60HDConfiguration)
    myConfiguration.setRolandV60HDConfiguration(rolandV60HD)

    if (newMixerName) {
      myConfiguration.setMixerSelection(newMixerName)
    }
  })
  socket.on('config.change.test', (newTestConfiguration, newMixerName) => {
    const test = new TestConfiguration()
    test.fromJson(newTestConfiguration)
    myConfiguration.setTestConfiguration(test)

    if (newMixerName) {
      myConfiguration.setMixerSelection(newMixerName)
    }
  })
  socket.on('config.change.vmix', (newVmixConfiguration, newMixerName) => {
    const vmix = new VmixConfiguration()
    vmix.fromJson(newVmixConfiguration)
    myConfiguration.setVmixConfiguration(vmix)

    if (newMixerName) {
      myConfiguration.setMixerSelection(newMixerName)
    }
  })
  socket.on('config.change.tallyconfig', (conf) => {
    const configuration = new DefaultTallyConfiguration()
    configuration.fromJson(conf)
    myConfiguration.setTallyConfiguration(configuration)
  })

  socket.on('flasher.device.get', (path) => {
    myNodeMcuConnector.getDevice(typeof path === 'string' ? path : undefined).then(device => {
      socket.emit('flasher.device', device.toJson())
    })
  })

  socket.on('flasher.settingsIni', (path, settingsIniString) => {
    myNodeMcuConnector.writeTallySettingsIni(path, settingsIniString, (state) => {
      socket.emit('flasher.settingsIni.progress', state)
    })
  })

  socket.on('flasher.program', (path) => {
    myNodeMcuConnector.program(path, (state) => {
      socket.emit('flasher.program.progress', state)
    })
  })
})

if (myConfiguration.isDev()) {
  const proxyPort = process.env.DEV_PROXY_PORT || 3001
  console.info(`Serving frontend via proxy. The React dev server is expected to run on port ${proxyPort}.`)

  app.use('/', createProxyMiddleware({ 
    target: `http://localhost:${proxyPort}`, 
    changeOrigin: true, 
    ws: true,
    on: {
      error: (err: Error & { code?: string }, req, res) => {
        if ('writeHead' in res) {
          res.writeHead(500, {
            'Content-Type': 'text/plain',
          });
          if (err && err.code === "ECONNREFUSED") {
            res.end(`Could not connect to server on http://localhost:${proxyPort}. Is the react dev server running?\nTo fix it run:\n    npm run start:frontend`)
          } else {
            res.end("The proxy reported an error: \n" + err.toString())
          }
        }
      },
    },
  }))
} else {
  const publicDirName = "frontend"
  console.info(`Serving frontend from directory ${publicDirName}`)
  const frontendDir = (process as NodeJS.Process & { pkg?: unknown }).pkg
    ? path.join(path.dirname(process.execPath), publicDirName)
    : path.join(__dirname, publicDirName)
  app.use('/', express.static(frontendDir))

  // fetch all route to allow deep-links into the application
  app.get('/{*path}', function(req, res) {
    res.sendFile(path.join(frontendDir, 'index.html'))
  })
}



server.on('error', (error: NodeJS.ErrnoException) => {
  exitWithStartupError(describeListenError(error, 'web (HTTP)', myConfiguration.getHttpPort()) +
    '\nTo use another web port, set the PORT environment variable.')
})
server.listen(myConfiguration.getHttpPort(), () => {
  console.log(`Web Server available on http://localhost:${myConfiguration.getHttpPort()}`)
})
