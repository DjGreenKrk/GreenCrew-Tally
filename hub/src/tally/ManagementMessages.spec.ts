import { crewPasswordFingerprint, pairedKey, unpairedKey, crewPasswordMessage, identifyMessage, isCrewPassword, pairMessage, parseManagementReply, unpairMessage } from './ManagementMessages'

// The same lines are checked by the firmware (firmware-v2/test/test_core/test_main.cpp).
const token = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex')
const challenge = '0123456789abcdef'

describe('ManagementMessages', () => {
  test('identify and pair', () => {
    expect(identifyMessage('1a2b3c4d')).toBe('gc/1 identify hub=1a2b3c4d\n')
    expect(pairMessage('1a2b3c4d', token)).toBe('gc/1 pair hub=1a2b3c4d token=000102030405060708090a0b0c0d0e0f\n')
  })

  test('unpair is signed like the firmware expects', () => {
    expect(unpairMessage('1a2b3c4d', token, challenge)).toBe(
      'gc/1 unpair hub=1a2b3c4d ch=0123456789abcdef mac=116021f9dac5f24818c91e757fdf61337d3eb235faedaec61e299456fbec5a57\n')
  })

  test('the crew password is hidden and signed like the firmware expects', () => {
    const nonce = '0011223344556677'
    expect(crewPasswordMessage('1a2b3c4d', token, challenge, 'crew pass 1!', nonce)).toBe(
      'gc/1 crew-password hub=1a2b3c4d ch=0123456789abcdef n=0011223344556677 pw=51f92847714d49addff68f56 ' +
      'mac=d1ca9620a44f9b3eae016dc24c77ebc6a55b1b96a30339f606a9b2400862445c\n')
    // 40 characters use the second block of the key stream
    expect(crewPasswordMessage('1a2b3c4d', token, challenge, 'x'.repeat(40), nonce)).toBe(
      'gc/1 crew-password hub=1a2b3c4d ch=0123456789abcdef n=0011223344556677 ' +
      'pw=4af33548294550a6d4aec60f0317e5dfda7d87ea75cc430cb0880f81b551f4dd920a5d85ca14f048 ' +
      'mac=7a868b24cb456fde089a1bfbe43c241f415826820365e56d8aacb55e134f2d9b\n')
    expect(crewPasswordMessage('1a2b3c4d', token, challenge, '')).toMatch(/^gc\/1 crew-password hub=1a2b3c4d ch=0123456789abcdef n=[0-9a-f]{16} pw= mac=[0-9a-f]{64}\n$/)
  })

  test('two crew passwords never share a key stream', () => {
    // a random nonce for every message: XOR of two messages with the same
    // challenge does not give away the second password
    const pw = (line: string) => Buffer.from(line.match(/ pw=([0-9a-f]*)/)![1], 'hex')
    const first = pw(crewPasswordMessage('1a2b3c4d', token, challenge, 'crew pass 1!'))
    const second = pw(crewPasswordMessage('1a2b3c4d', token, challenge, 'crew pass 2!'))
    const guess = Buffer.from(first.map((byte, i) => byte ^ second[i] ^ 'crew pass 1!'.charCodeAt(i))).toString('latin1')
    expect(guess).not.toBe('crew pass 2!')
  })

  test('the tally names the crew password it took like the Hub expects', () => {
    expect(crewPasswordFingerprint(token, '0011223344556677', 'crew pass 1!')).toBe('438215481bc00c4c')
    expect(crewPasswordFingerprint(token, '0011223344556677', 'x'.repeat(40))).toBe('d256f19e9614e551')
    expect(crewPasswordFingerprint(token, '0011223344556677', '')).toBe('2a79bba229496162')
    expect(pairedKey(token)).toBe('fdbdef57e8036737')
    expect(unpairedKey(token, challenge)).toBe('886532c4c183298c')
  })

  test('crew passwords are WPA2 passphrases', () => {
    expect(isCrewPassword('crew pass 1!')).toBe(true)
    expect(isCrewPassword('short')).toBe(false)
    expect(isCrewPassword('x'.repeat(64))).toBe(false)
    expect(isCrewPassword('hasło-ekipy')).toBe(false)
  })

  test('replies of the tally', () => {
    expect(parseManagementReply('gc/1 paired id=a1b2c3 hub=1a2b3c4d key=fdbdef57e8036737\n')).toEqual(
      { kind: 'paired', id: 'a1b2c3', hub: '1a2b3c4d', key: 'fdbdef57e8036737' })
    expect(parseManagementReply('gc/1 unpaired id=a1b2c3 hub=1a2b3c4d key=886532c4c183298c')).toEqual(
      { kind: 'unpaired', id: 'a1b2c3', hub: '1a2b3c4d', key: '886532c4c183298c' })
    expect(parseManagementReply('gc/1 unpaired id=a1b2c3 hub=1a2b3c4d')).toBeUndefined()
    expect(parseManagementReply('gc/1 crew-password-set id=a1b2c3 hub=1a2b3c4d crew=db920b6aae174b52')).toEqual(
      { kind: 'crew-password-set', id: 'a1b2c3', hub: '1a2b3c4d', crew: 'db920b6aae174b52' })
    expect(parseManagementReply('gc/1 crew-password-set id=a1b2c3 hub=1a2b3c4d')).toBeUndefined()
    expect(parseManagementReply('gc/1 refused id=a1b2c3 to=pair why=paired-elsewhere\n')).toEqual({ kind: 'refused', id: 'a1b2c3', to: 'pair', why: 'paired-elsewhere' })
    expect(parseManagementReply('gc/1 paired hub=1a2b3c4d')).toBeUndefined()
    expect(parseManagementReply('gc/1 something id=a1b2c3')).toBeUndefined()
    expect(parseManagementReply('tally-ho "x"')).toBeUndefined()
  })
})
