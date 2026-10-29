import { randomBytes } from 'crypto'
import { AppConfiguration } from '../lib/AppConfiguration'
import { TallyPairing } from './CommandParser'
import { DeviceListState, DeviceView } from './DeviceList'
import { crewPasswordFingerprint, crewPasswordMessage, identifyMessage, ManagementReply, pairMessage, TOKEN_BYTES, unpairMessage } from './ManagementMessages'

// Firmware v2 tallies the Hub knows of, from their "tally-ho" and from mDNS
// (_gctally-device._udp), keyed by the device id so duplicate names and new
// IP addresses do not mix them up (#28). Pairing, unpairing and the crew
// password go through here; only paired tallies are stored (AppConfiguration).

export type Send = (text: string, address: string, port: number) => void

type Entry = {
  id: string
  name: string
  firmware?: string
  address?: string
  port?: number
  udpSeenAt?: number
  mdnsUp: boolean
  // from the tally: null not paired, undefined not told
  reportedHub?: string | null
  challenge?: string
  pendingPair?: { token: Buffer, since: number, sentAt: number }
  pendingUnpair?: { since: number, sentWith: string, sentAt: number }
  crewSent?: { challenge: string, at: number, version: string }
  pairedAt?: number
  lastError?: string
}

const UDP_ONLINE_MS = 5000
const PAIR_RETRY_MS = 1000
const GIVE_UP_MS = 10000
const CREW_RETRY_MS = 5000
// a "tally-ho" sent just before the pairing must not undo it
const PAIRING_SETTLE_MS = 10000

export default class DeviceRegistry {
  private entries = new Map<string, Entry>()
  private lastState = ''

  constructor(
    private readonly configuration: AppConfiguration,
    private readonly send: Send,
    private readonly onChange: (state: Omit<DeviceListState, 'canChangeCrewPassword'>) => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  private entry(id: string, name: string): Entry {
    let entry = this.entries.get(id)
    if (!entry) {
      entry = { id, name, mdnsUp: false }
      this.entries.set(id, entry)
    }
    return entry
  }

  helloReceived(id: string, name: string, firmware: string | undefined, address: string, port: number, pairing?: TallyPairing) {
    const entry = this.entry(id, name)
    entry.name = name
    entry.firmware = firmware
    entry.address = address
    entry.port = port
    entry.udpSeenAt = this.now()
    if (pairing) {
      entry.reportedHub = pairing.hub
      entry.challenge = pairing.challenge
    }
    const paired = this.configuration.getPairedDevice(id)
    // unpaired on the tally's setup page: the Hub follows
    if (paired && pairing && pairing.hub !== this.hubId() && !entry.pendingPair &&
        this.now() - (entry.pairedAt ?? 0) > PAIRING_SETTLE_MS) {
      console.info(`Tally ${name} (${id}) is no longer paired with this Hub`)
      this.configuration.removePairedDevice(id)
    }
    if (paired && paired.name !== name) this.configuration.setPairedDevice({ ...paired, name })
    this.retryUnpair(entry)
  }

  mdnsUp(id: string, name: string, firmware: string | undefined, address: string | undefined, port: number, pair?: string) {
    const entry = this.entry(id, name)
    entry.mdnsUp = true
    if (!entry.udpSeenAt || this.now() - entry.udpSeenAt > UDP_ONLINE_MS) {
      // "tally-ho" is more recent than what mDNS knows
      entry.name = name
      entry.firmware = firmware
      if (address) entry.address = address
      entry.port = port
      if (pair !== undefined) entry.reportedHub = /^[0-9a-f]{8}$/.test(pair) ? pair : null
    }
    this.emitIfChanged()
  }

  mdnsDown(id: string) {
    const entry = this.entries.get(id)
    if (entry) entry.mdnsUp = false
    this.emitIfChanged()
  }

  replyReceived(reply: ManagementReply) {
    const entry = this.entries.get(reply.id)
    if (!entry) return
    const hubId = this.hubId()
    // an accepted message changes the challenge: wait for the next "tally-ho"
    if (reply.kind !== 'refused') entry.challenge = undefined
    if (reply.kind === 'paired' && reply.hub === hubId && entry.pendingPair) {
      const crew = this.configuration.getCrewPassword()
      this.configuration.setPairedDevice({
        id: entry.id,
        name: entry.name,
        token: entry.pendingPair.token.toString('hex'),
        // the tally drops a crew password from before; nothing to send for none
        crewPasswordVersion: crew.password === '' ? crew.version : '',
      })
      entry.pendingPair = undefined
      entry.pairedAt = this.now()
      entry.reportedHub = hubId
      entry.lastError = undefined
      console.info(`Paired tally ${entry.name} (${entry.id})`)
    } else if (reply.kind === 'unpaired' && reply.hub === hubId) {
      this.configuration.removePairedDevice(entry.id)
      entry.pendingUnpair = undefined
      entry.reportedHub = null
      console.info(`Unpaired tally ${entry.name} (${entry.id})`)
    } else if (reply.kind === 'crew-password-set' && reply.hub === hubId) {
      // only an answer to the current password counts; for an older one it
      // is sent again with the next challenge
      const paired = this.configuration.getPairedDevice(entry.id)
      const crew = this.configuration.getCrewPassword()
      if (paired && reply.crew === crewPasswordFingerprint(Buffer.from(paired.token, 'hex'), crew.password)) {
        this.configuration.setPairedDevice({ ...paired, crewPasswordVersion: crew.version })
        entry.crewSent = undefined
      }
    } else if (reply.kind === 'refused') {
      if (reply.why === 'challenge') return  // sent again with the next "tally-ho"
      if (reply.to === 'unpair' && reply.why === 'not-paired') {
        // the tally does not consider itself ours any more
        this.configuration.removePairedDevice(entry.id)
        entry.pendingUnpair = undefined
      } else {
        entry.lastError = reply.why
        if (reply.to === 'pair') entry.pendingPair = undefined
        if (reply.to === 'unpair') entry.pendingUnpair = undefined
        if (reply.to === 'crew-password') entry.crewSent = undefined
      }
      console.warn(`Tally ${entry.name} (${entry.id}) refused ${reply.to}: ${reply.why}`)
    }
    this.emitIfChanged()
  }

  // Lets the tally blink white, so the operator knows which one it is.
  identify(id: string) {
    const entry = this.entries.get(id)
    if (!entry?.address || !entry.port) return false
    this.send(identifyMessage(this.hubId()), entry.address, entry.port)
    return true
  }

  pair(id: string) {
    const entry = this.entries.get(id)
    if (!entry?.address || !entry.port || this.configuration.getPairedDevice(id)) return false
    const now = this.now()
    entry.pendingPair = { token: randomBytes(TOKEN_BYTES), since: now, sentAt: now }
    entry.lastError = undefined
    this.send(pairMessage(this.hubId(), entry.pendingPair.token), entry.address, entry.port)
    this.emitIfChanged()
    return true
  }

  // Needs the tally online: the message is signed with its current challenge,
  // sent as soon as the next "tally-ho" brings one.
  unpair(id: string) {
    const entry = this.entries.get(id)
    if (!entry || !this.configuration.getPairedDevice(id) || !this.isUdpOnline(entry)) return false
    entry.pendingUnpair = { since: this.now(), sentWith: '', sentAt: 0 }
    entry.lastError = undefined
    this.retryUnpair(entry)
    this.emitIfChanged()
    return true
  }

  // For a tally that is gone: the Hub drops the token; the tally can be
  // unpaired on its setup page.
  forget(id: string) {
    this.configuration.removePairedDevice(id)
    const entry = this.entries.get(id)
    if (entry) {
      entry.pendingUnpair = undefined
      if (!this.isOnline(entry)) this.entries.delete(id)
    }
    this.emitIfChanged()
  }

  // Retries, the crew password, and the list on the page; call every 500 ms.
  tick() {
    const now = this.now()
    for (const entry of this.entries.values()) {
      if (entry.pendingPair) {
        if (now - entry.pendingPair.since > GIVE_UP_MS) {
          entry.pendingPair = undefined
          entry.lastError = 'no-answer'
        } else if (now - entry.pendingPair.sentAt >= PAIR_RETRY_MS && entry.address && entry.port) {
          entry.pendingPair.sentAt = now
          this.send(pairMessage(this.hubId(), entry.pendingPair.token), entry.address, entry.port)
        }
      }
      if (entry.pendingUnpair && now - entry.pendingUnpair.since > GIVE_UP_MS) {
        entry.pendingUnpair = undefined
        entry.lastError = 'no-answer'
      }
      this.retryUnpair(entry)
      this.syncCrewPassword(entry)
    }
    this.emitIfChanged()
  }

  getState(): Omit<DeviceListState, 'canChangeCrewPassword'> {
    const views = [...this.entries.values()].map(entry => this.view(entry))
    for (const view of views) {
      view.duplicateName = view.online && views.some(other => other !== view && other.online && other.name === view.name)
    }
    // paired tallies that are not around stay listed
    for (const paired of this.configuration.getPairedDevices()) {
      if (!this.entries.has(paired.id)) {
        views.push({ id: paired.id, name: paired.name, online: false, via: [], status: 'paired', pairedHub: this.hubId(),
          crewPassword: this.crewState(paired.crewPasswordVersion), duplicateName: false })
      }
    }
    views.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    return { hubId: this.hubId(), devices: views, crewPasswordSet: this.configuration.getCrewPassword().password !== '' }
  }

  private hubId() {
    return this.configuration.getHubId()
  }

  private isUdpOnline(entry: Entry) {
    return entry.udpSeenAt !== undefined && this.now() - entry.udpSeenAt <= UDP_ONLINE_MS
  }

  private isOnline(entry: Entry) {
    return this.isUdpOnline(entry) || entry.mdnsUp
  }

  private retryUnpair(entry: Entry) {
    const paired = this.configuration.getPairedDevice(entry.id)
    if (!entry.pendingUnpair || !paired || !entry.challenge || !entry.address || !entry.port) return
    // at once with a new challenge, else again in case the packet was lost
    const now = this.now()
    if (entry.pendingUnpair.sentWith === entry.challenge && now - entry.pendingUnpair.sentAt < PAIR_RETRY_MS) return
    entry.pendingUnpair.sentWith = entry.challenge
    entry.pendingUnpair.sentAt = now
    this.send(unpairMessage(this.hubId(), Buffer.from(paired.token, 'hex'), entry.challenge), entry.address, entry.port)
  }

  private syncCrewPassword(entry: Entry) {
    const paired = this.configuration.getPairedDevice(entry.id)
    const crew = this.configuration.getCrewPassword()
    if (!paired || paired.crewPasswordVersion === crew.version) return
    if (!this.isUdpOnline(entry) || !entry.challenge || entry.reportedHub !== this.hubId() || !entry.address || !entry.port) return
    const now = this.now()
    const sent = entry.crewSent
    // once per challenge; again after a while in case the packet was lost
    if (sent && sent.version === crew.version && (sent.challenge === entry.challenge || now - sent.at < 500) && now - sent.at < CREW_RETRY_MS) return
    entry.crewSent = { challenge: entry.challenge, at: now, version: crew.version }
    this.send(crewPasswordMessage(this.hubId(), Buffer.from(paired.token, 'hex'), entry.challenge, crew.password), entry.address, entry.port)
  }

  private crewState(version: string): DeviceView['crewPassword'] {
    const crew = this.configuration.getCrewPassword()
    if (version !== crew.version) return 'pending'
    return crew.password === '' ? 'none' : 'synced'
  }

  private view(entry: Entry): DeviceView {
    const hubId = this.hubId()
    const paired = this.configuration.getPairedDevice(entry.id)
    let status: DeviceView['status']
    if (entry.pendingPair) status = 'pairing'
    else if (paired) status = 'paired'
    else if (entry.reportedHub === hubId) status = 'tokenLost'
    else if (entry.reportedHub) status = 'pairedElsewhere'
    else if (entry.reportedHub === null) status = 'unpaired'
    else status = 'unknown'
    const via: DeviceView['via'] = []
    if (this.isUdpOnline(entry)) via.push('udp')
    if (entry.mdnsUp) via.push('mdns')
    return {
      id: entry.id,
      name: entry.name,
      firmware: entry.firmware,
      address: entry.address,
      online: this.isOnline(entry),
      via,
      status,
      pairedHub: entry.reportedHub ?? undefined,
      crewPassword: paired ? this.crewState(paired.crewPasswordVersion) : 'none',
      duplicateName: false,
      lastError: entry.lastError,
    }
  }

  private emitIfChanged() {
    const state = this.getState()
    const text = JSON.stringify(state)
    if (text === this.lastState) return
    this.lastState = text
    this.onChange(state)
  }
}
