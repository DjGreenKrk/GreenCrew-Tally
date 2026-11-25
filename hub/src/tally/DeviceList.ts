// What the Configuration page shows about firmware v2 tallies (#28).
// Also used in the browser: no Node modules here.

// The crew password must work as a WPA2 passphrase on every tally.
export function isCrewPassword(password: string) {
  return /^[\x20-\x7e]{8,63}$/.test(password)
}

export type DeviceStatus =
  | 'unpaired'
  | 'pairing'          // waiting for the tally to answer
  | 'paired'           // paired with this Hub
  | 'pairedElsewhere'  // paired with another Hub
  | 'tokenLost'        // the tally says it is paired with this Hub, but the Hub has no token (config reset)
  | 'unknown'          // seen over mDNS from older firmware that does not tell

export type DeviceView = {
  id: string
  name: string
  firmware?: string
  address?: string
  online: boolean
  via: ('udp' | 'mdns')[]
  status: DeviceStatus
  pairedHub?: string
  // whether the tally has the Hub's current crew password
  crewPassword: 'synced' | 'pending' | 'none'
  // another online tally has the same name
  duplicateName: boolean
  // the Hub still has a token, but the tally says it is no longer paired
  // with this Hub (unpaired on its setup page, or the Hub's answer was lost);
  // only pairing again or "forget" removes the token
  staleToken: boolean
  // the last refusal of the tally, e.g. "paired-elsewhere"
  lastError?: string
}

export type DeviceListState = {
  hubId: string
  devices: DeviceView[]
  crewPasswordSet: boolean
  // only on the Hub computer itself
  canChangeCrewPassword: boolean
}
