import { EventEmitter } from 'events'
import { AppConfiguration } from '../lib/AppConfiguration'
import ServerEventEmitter from '../lib/ServerEventEmitter'
import DeviceRegistry from './DeviceRegistry'
import { crewPasswordFingerprint, crewPasswordMessage, unpairMessage } from './ManagementMessages'

const challenge1 = '0123456789abcdef'
const challenge2 = 'fedcba9876543210'

function setup() {
  const configuration = new AppConfiguration(new EventEmitter() as ServerEventEmitter)
  configuration.fromJson({ hubId: '1a2b3c4d' })
  let now = 1000
  const sent: { text: string, address: string, port: number }[] = []
  const states: ReturnType<DeviceRegistry['getState']>[] = []
  const registry = new DeviceRegistry(configuration, (text, address, port) => sent.push({ text, address, port }), state => states.push(state), () => now)
  const advance = (ms: number) => { now += ms }
  const hello = (hub: string | null, challenge = challenge1, name = 'CAM1', id = 'a1b2c3', address = '10.0.0.5') =>
    registry.helloReceived(id, name, '2.0.0', address, 7411, { hub, challenge })
  return { configuration, registry, sent, states, advance, hello }
}

function pairedSetup() {
  const context = setup()
  context.hello(null)
  context.registry.pair('a1b2c3')
  context.registry.replyReceived({ kind: 'paired', id: 'a1b2c3', hub: '1a2b3c4d' })
  context.sent.length = 0
  return context
}

describe('DeviceRegistry', () => {
  test('lists a tally from its hello as unpaired', () => {
    const { registry, hello } = setup()
    hello(null)
    expect(registry.getState().devices).toEqual([{
      id: 'a1b2c3', name: 'CAM1', firmware: '2.0.0', address: '10.0.0.5', online: true, via: ['udp'],
      status: 'unpaired', pairedHub: undefined, crewPassword: 'none', duplicateName: false, lastError: undefined,
    }])
  })

  test('lists tallies found over mDNS, paired with another Hub', () => {
    const { registry } = setup()
    registry.mdnsUp('d4e5f6', 'CAM2', '2.0.0', '10.0.0.6', 7411, '99999999')
    const [device] = registry.getState().devices
    expect(device).toMatchObject({ id: 'd4e5f6', status: 'pairedElsewhere', pairedHub: '99999999', via: ['mdns'], online: true })
    registry.mdnsDown('d4e5f6')
    expect(registry.getState().devices[0].online).toBe(false)
  })

  test('identify makes the tally blink', () => {
    const { registry, sent, hello } = setup()
    expect(registry.identify('a1b2c3')).toBe(false)
    hello(null)
    expect(registry.identify('a1b2c3')).toBe(true)
    expect(sent).toEqual([{ text: 'gc/1 identify hub=1a2b3c4d\n', address: '10.0.0.5', port: 7411 }])
  })

  test('pairs once the tally answers and keeps the token', () => {
    const { registry, sent, hello, configuration, advance } = setup()
    hello(null)
    expect(registry.pair('a1b2c3')).toBe(true)
    expect(sent[0].text).toMatch(/^gc\/1 pair hub=1a2b3c4d token=[0-9a-f]{32}\n$/)
    expect(registry.getState().devices[0].status).toBe('pairing')
    // sent again when the answer is lost
    advance(1000)
    registry.tick()
    expect(sent).toHaveLength(2)
    expect(sent[1].text).toEqual(sent[0].text)

    registry.replyReceived({ kind: 'paired', id: 'a1b2c3', hub: '1a2b3c4d' })
    const token = sent[0].text.match(/token=([0-9a-f]{32})/)![1]
    expect(configuration.getPairedDevices()).toEqual([{ id: 'a1b2c3', name: 'CAM1', token, crewPasswordVersion: '' }])
    expect(registry.getState().devices[0].status).toBe('paired')
    // an older hello still saying "not paired" does not undo it
    hello(null)
    expect(configuration.getPairedDevice('a1b2c3')).toBeDefined()
  })

  test('gives up pairing without an answer and shows a refusal', () => {
    const { registry, hello, advance, configuration } = setup()
    hello(null)
    registry.pair('a1b2c3')
    advance(11000)
    registry.tick()
    expect(registry.getState().devices[0]).toMatchObject({ status: 'unpaired', lastError: 'no-answer' })

    registry.pair('a1b2c3')
    registry.replyReceived({ kind: 'refused', id: 'a1b2c3', to: 'pair', why: 'paired-elsewhere' })
    expect(registry.getState().devices[0]).toMatchObject({ status: 'unpaired', lastError: 'paired-elsewhere' })
    expect(configuration.getPairedDevices()).toEqual([])
  })

  test('unpairs with a signed message and the current challenge', () => {
    const { registry, sent, hello, configuration } = pairedSetup()
    const token = Buffer.from(configuration.getPairedDevice('a1b2c3')!.token, 'hex')
    hello('1a2b3c4d', challenge1)
    expect(registry.unpair('a1b2c3')).toBe(true)
    expect(sent.map(s => s.text)).toEqual([unpairMessage('1a2b3c4d', token, challenge1)])
    // the challenge was stale: sent again with the next one
    registry.replyReceived({ kind: 'refused', id: 'a1b2c3', to: 'unpair', why: 'challenge' })
    hello('1a2b3c4d', challenge1)
    expect(sent).toHaveLength(1)
    hello('1a2b3c4d', challenge2)
    expect(sent[1].text).toEqual(unpairMessage('1a2b3c4d', token, challenge2))

    registry.replyReceived({ kind: 'unpaired', id: 'a1b2c3', hub: '1a2b3c4d' })
    expect(configuration.getPairedDevices()).toEqual([])
    expect(registry.getState().devices[0].status).toBe('unpaired')
  })

  test('unpairing is sent again when the message or the answer is lost', () => {
    const { registry, sent, hello, configuration, advance } = pairedSetup()
    const token = Buffer.from(configuration.getPairedDevice('a1b2c3')!.token, 'hex')
    hello('1a2b3c4d', challenge1)
    registry.unpair('a1b2c3')
    // lost: the tally keeps its challenge, the Hub sends again after a second
    advance(500)
    registry.tick()
    expect(sent).toHaveLength(1)
    advance(500)
    registry.tick()
    expect(sent.map(s => s.text)).toEqual([unpairMessage('1a2b3c4d', token, challenge1), unpairMessage('1a2b3c4d', token, challenge1)])
    // taken, but the answer lost: the tally says it is no longer paired
    registry.replyReceived({ kind: 'refused', id: 'a1b2c3', to: 'unpair', why: 'not-paired' })
    expect(configuration.getPairedDevices()).toEqual([])
    expect(registry.getState().devices[0].lastError).toBeUndefined()
  })

  test('follows a tally unpaired on its setup page', () => {
    const { registry, hello, configuration, advance } = pairedSetup()
    advance(11000)
    hello(null)
    expect(configuration.getPairedDevices()).toEqual([])
    expect(registry.getState().devices[0].status).toBe('unpaired')
  })

  test('forget keeps no token; the tally then reports a lost pairing', () => {
    const { registry, hello, configuration } = pairedSetup()
    hello('1a2b3c4d')
    registry.forget('a1b2c3')
    expect(configuration.getPairedDevices()).toEqual([])
    expect(registry.getState().devices[0].status).toBe('tokenLost')
  })

  test('paired tallies that are away stay listed', () => {
    const { configuration, registry } = setup()
    configuration.setPairedDevice({ id: 'ffeedd', name: 'CAM9', token: '000102030405060708090a0b0c0d0e0f', crewPasswordVersion: '' })
    expect(registry.getState().devices).toEqual([expect.objectContaining({ id: 'ffeedd', name: 'CAM9', online: false, status: 'paired' })])
  })

  test('sends the crew password to paired tallies until they confirm it', () => {
    const { registry, sent, hello, configuration, advance } = pairedSetup()
    const token = Buffer.from(configuration.getPairedDevice('a1b2c3')!.token, 'hex')
    hello('1a2b3c4d', challenge1)
    registry.tick()
    expect(sent).toEqual([])

    configuration.setCrewPassword('crew pass 1!')
    registry.tick()
    expect(sent.map(s => s.text)).toEqual([crewPasswordMessage('1a2b3c4d', token, challenge1, 'crew pass 1!')])
    expect(registry.getState().devices[0].crewPassword).toBe('pending')
    advance(500)
    registry.tick()
    expect(sent).toHaveLength(1)

    registry.replyReceived({ kind: 'crew-password-set', id: 'a1b2c3', hub: '1a2b3c4d', crew: crewPasswordFingerprint(token, 'crew pass 1!') })
    expect(configuration.getPairedDevice('a1b2c3')!.crewPasswordVersion).toEqual(configuration.getCrewPassword().version)
    expect(registry.getState().devices[0].crewPassword).toBe('synced')
    expect(registry.getState().crewPasswordSet).toBe(true)

    // cleared: the tallies forget it too, sent with the next challenge only
    configuration.setCrewPassword('')
    advance(1000)
    registry.tick()
    expect(sent).toHaveLength(1)
    hello('1a2b3c4d', challenge2)
    registry.tick()
    expect(sent[1].text).toEqual(crewPasswordMessage('1a2b3c4d', token, challenge2, ''))
  })

  test('an answer to an older crew password does not count for the current one', () => {
    const { registry, sent, hello, configuration, advance } = pairedSetup()
    const token = Buffer.from(configuration.getPairedDevice('a1b2c3')!.token, 'hex')
    hello('1a2b3c4d', challenge1)
    configuration.setCrewPassword('crew pass 1!')
    registry.tick()
    // changed before the tally answered: sent with the same challenge, the tally refuses it
    configuration.setCrewPassword('crew pass 2!')
    registry.tick()
    expect(sent.map(s => s.text)).toEqual([
      crewPasswordMessage('1a2b3c4d', token, challenge1, 'crew pass 1!'),
      crewPasswordMessage('1a2b3c4d', token, challenge1, 'crew pass 2!'),
    ])
    registry.replyReceived({ kind: 'crew-password-set', id: 'a1b2c3', hub: '1a2b3c4d', crew: crewPasswordFingerprint(token, 'crew pass 1!') })
    registry.replyReceived({ kind: 'refused', id: 'a1b2c3', to: 'crew-password', why: 'challenge' })
    expect(registry.getState().devices[0].crewPassword).toBe('pending')

    advance(1000)
    hello('1a2b3c4d', challenge2)
    registry.tick()
    expect(sent[2].text).toEqual(crewPasswordMessage('1a2b3c4d', token, challenge2, 'crew pass 2!'))
    registry.replyReceived({ kind: 'crew-password-set', id: 'a1b2c3', hub: '1a2b3c4d', crew: crewPasswordFingerprint(token, 'crew pass 2!') })
    expect(registry.getState().devices[0].crewPassword).toBe('synced')
  })

  test('marks online tallies with the same name', () => {
    const { registry, hello } = setup()
    hello(null, challenge1, 'CAM1', 'a1b2c3', '10.0.0.5')
    hello(null, challenge1, 'CAM1', 'd4e5f6', '10.0.0.6')
    expect(registry.getState().devices.map(d => d.duplicateName)).toEqual([true, true])
  })

  test('tells the page only about changes', () => {
    const { registry, states, hello } = setup()
    hello(null)
    registry.tick()
    registry.tick()
    expect(states).toHaveLength(1)
  })
})
