import { createHmac } from 'crypto'

// Management messages between the Hub and firmware v2 tallies (#28), one
// line each on the tally's UDP port, apart from the state packets. The
// tally side is firmware-v2/lib/tally_core/src/Pairing.h; both sides are
// tested with the same lines.
//
// mac: HMAC-SHA256 with the pairing token over the line before " mac=".
// ch: the challenge from the tally's last "tally-ho"; the tally takes a new
// one after every accepted message, so a recorded line cannot be replayed.

export const TOKEN_BYTES = 16

function mac(token: Buffer, line: string) {
  return createHmac('sha256', token).update(line).digest('hex')
}

function signed(token: Buffer, line: string) {
  return `${line} mac=${mac(token, line)}\n`
}

// The crew password XOR HMAC(token, "crew-password <ch> <block>"), 32 bytes a block
function crewKeyStream(token: Buffer, challenge: string, length: number) {
  const blocks: Buffer[] = []
  for (let block = 0; block * 32 < length; block++) {
    blocks.push(createHmac('sha256', token).update(`crew-password ${challenge} ${block}`).digest())
  }
  return Buffer.concat(blocks).subarray(0, length)
}

export function identifyMessage(hubId: string) {
  return `gc/1 identify hub=${hubId}\n`
}

export function pairMessage(hubId: string, token: Buffer) {
  return `gc/1 pair hub=${hubId} token=${token.toString('hex')}\n`
}

export function unpairMessage(hubId: string, token: Buffer, challenge: string) {
  return signed(token, `gc/1 unpair hub=${hubId} ch=${challenge}`)
}

// An empty password clears the one the Hub set before.
export function crewPasswordMessage(hubId: string, token: Buffer, challenge: string, password: string) {
  const plain = Buffer.from(password, 'latin1')
  const stream = crewKeyStream(token, challenge, plain.length)
  const hidden = Buffer.from(plain.map((byte, i) => byte ^ stream[i])).toString('hex')
  return signed(token, `gc/1 crew-password hub=${hubId} ch=${challenge} pw=${hidden}`)
}

// Names the crew password in the tally's "crew-password-set" answer, so an
// answer to an older password is not taken for the current one.
export function crewPasswordFingerprint(token: Buffer, password: string) {
  return createHmac('sha256', token).update(Buffer.from(`crew-password-set ${password}`, 'latin1')).digest('hex').slice(0, 16)
}

export { isCrewPassword } from './DeviceList'

export type ManagementReply =
  | { kind: 'paired' | 'unpaired', id: string, hub: string }
  | { kind: 'crew-password-set', id: string, hub: string, crew: string }
  | { kind: 'refused', id: string, to: string, why: string }

export function parseManagementReply(line: string): ManagementReply | undefined {
  const words = line.trim().split(/ +/)
  if (words[0] !== 'gc/1' || words.length < 2) return undefined
  const fields: Record<string, string> = {}
  for (const word of words.slice(2)) {
    const equals = word.indexOf('=')
    if (equals > 0) fields[word.slice(0, equals)] = word.slice(equals + 1)
  }
  const kind = words[1]
  if (!fields.id) return undefined
  if (kind === 'paired' || kind === 'unpaired') {
    return fields.hub ? { kind, id: fields.id, hub: fields.hub } : undefined
  }
  if (kind === 'crew-password-set') {
    return fields.hub && fields.crew ? { kind, id: fields.id, hub: fields.hub, crew: fields.crew } : undefined
  }
  if (kind === 'refused') return { kind, id: fields.id, to: fields.to || '', why: fields.why || '' }
  return undefined
}
