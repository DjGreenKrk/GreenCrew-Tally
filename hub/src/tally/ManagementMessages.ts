import { createHmac, randomBytes } from 'crypto'

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

// The crew password XOR HMAC(token, "crew-password <ch> <nonce> <block>"),
// 32 bytes a block. The nonce is new for every message: two passwords sent
// with the same challenge must not share a key stream.
function crewKeyStream(token: Buffer, challenge: string, nonce: string, length: number) {
  const blocks: Buffer[] = []
  for (let block = 0; block * 32 < length; block++) {
    blocks.push(createHmac('sha256', token).update(`crew-password ${challenge} ${nonce} ${block}`).digest())
  }
  return Buffer.concat(blocks).subarray(0, length)
}

export function identifyMessage(hubId: string) {
  return `gc/1 identify hub=${hubId}\n`
}

export function pairMessage(hubId: string, token: Buffer) {
  return `gc/1 pair hub=${hubId} token=${token.toString('hex')}\n`
}

// The answers to a pairing were lost: the tally names its token (signed over
// its challenge) without anything secret crossing the network.
export function pairCheckMessage(hubId: string, challenge: string) {
  return `gc/1 pair-check hub=${hubId} ch=${challenge}\n`
}

export function unpairMessage(hubId: string, token: Buffer, challenge: string) {
  return signed(token, `gc/1 unpair hub=${hubId} ch=${challenge}`)
}

// An empty password clears the one the Hub set before. nonce: 16 hex, random
// unless given (tests).
export function crewPasswordMessage(hubId: string, token: Buffer, challenge: string, password: string,
  nonce = randomBytes(8).toString('hex')) {
  const plain = Buffer.from(password, 'latin1')
  const stream = crewKeyStream(token, challenge, nonce, plain.length)
  const hidden = Buffer.from(plain.map((byte, i) => byte ^ stream[i])).toString('hex')
  return signed(token, `gc/1 crew-password hub=${hubId} ch=${challenge} n=${nonce} pw=${hidden}`)
}

function fingerprint(token: Buffer, text: string) {
  return createHmac('sha256', token).update(Buffer.from(text, 'latin1')).digest('hex').slice(0, 16)
}

// Names the token in the tally's "paired" answer, so the Hub knows which of
// the tokens it sent the tally took.
export function pairedKey(token: Buffer) {
  return fingerprint(token, 'paired')
}

// The answer to "pair-check"
export function pairCheckKey(token: Buffer, challenge: string) {
  return fingerprint(token, `paired ${challenge}`)
}

// Signs the tally's "unpaired" answer, so nobody else can make the Hub drop
// the token. challenge: the one in the "unpair" the tally took.
export function unpairedKey(token: Buffer, challenge: string) {
  return fingerprint(token, `unpaired ${challenge}`)
}

// Names the message (its nonce) and the password in the tally's
// "crew-password-set" answer, so a late answer to an older message is not
// taken for the current one.
export function crewPasswordFingerprint(token: Buffer, nonce: string, password: string) {
  return fingerprint(token, `crew-password-set ${nonce} ${password}`)
}

export { isCrewPassword } from './DeviceList'

export type ManagementReply =
  // ch: the answer to "pair-check" with that challenge
  | { kind: 'paired', id: string, hub: string, key: string, ch?: string }
  | { kind: 'unpaired', id: string, hub: string, key: string }
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
  if (kind === 'paired') {
    if (!fields.hub || !fields.key) return undefined
    return fields.ch ? { kind, id: fields.id, hub: fields.hub, key: fields.key, ch: fields.ch } : { kind, id: fields.id, hub: fields.hub, key: fields.key }
  }
  if (kind === 'unpaired') {
    return fields.hub && fields.key ? { kind, id: fields.id, hub: fields.hub, key: fields.key } : undefined
  }
  if (kind === 'crew-password-set') {
    return fields.hub && fields.crew ? { kind, id: fields.id, hub: fields.hub, crew: fields.crew } : undefined
  }
  if (kind === 'refused') return { kind, id: fields.id, to: fields.to || '', why: fields.why || '' }
  return undefined
}
