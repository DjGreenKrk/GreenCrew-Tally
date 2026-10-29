import { crewPasswordFingerprint, pairedKey, crewPasswordMessage, identifyMessage, isCrewPassword, pairMessage, parseManagementReply, unpairMessage } from './ManagementMessages'

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
    expect(crewPasswordMessage('1a2b3c4d', token, challenge, 'crew pass 1!')).toBe(
      'gc/1 crew-password hub=1a2b3c4d ch=0123456789abcdef pw=d505288317e7f77461e09333 ' +
      'mac=42f41681e373057a823deb4bc51c979644bada6df62e77ac3160ca83d1e5d980\n')
    // 40 characters use the second block of the key stream
    expect(crewPasswordMessage('1a2b3c4d', token, challenge, 'x'.repeat(40))).toBe(
      'gc/1 crew-password hub=1a2b3c4d ch=0123456789abcdef ' +
      'pw=ce0f358c4fefee7f6ab8da6a8a82c68f36855629d4e8f6000e60477e35b031ce41fc8985d178474b ' +
      'mac=84f3588744b3eb4a7bae7b65146aa2c143afe33ff94e323f349525b7ae0c0bbc\n')
    expect(crewPasswordMessage('1a2b3c4d', token, challenge, '')).toMatch(/^gc\/1 crew-password hub=1a2b3c4d ch=0123456789abcdef pw= mac=[0-9a-f]{64}\n$/)
  })

  test('the tally names the crew password it took like the Hub expects', () => {
    expect(crewPasswordFingerprint(token, 'crew pass 1!')).toBe('db920b6aae174b52')
    expect(crewPasswordFingerprint(token, 'x'.repeat(40))).toBe('781693d3e3d94b59')
    expect(crewPasswordFingerprint(token, '')).toBe('088970114d5c5f56')
    expect(pairedKey(token)).toBe('fdbdef57e8036737')
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
    expect(parseManagementReply('gc/1 unpaired id=a1b2c3 hub=1a2b3c4d')).toEqual({ kind: 'unpaired', id: 'a1b2c3', hub: '1a2b3c4d' })
    expect(parseManagementReply('gc/1 crew-password-set id=a1b2c3 hub=1a2b3c4d crew=db920b6aae174b52')).toEqual(
      { kind: 'crew-password-set', id: 'a1b2c3', hub: '1a2b3c4d', crew: 'db920b6aae174b52' })
    expect(parseManagementReply('gc/1 crew-password-set id=a1b2c3 hub=1a2b3c4d')).toBeUndefined()
    expect(parseManagementReply('gc/1 refused id=a1b2c3 to=pair why=paired-elsewhere\n')).toEqual({ kind: 'refused', id: 'a1b2c3', to: 'pair', why: 'paired-elsewhere' })
    expect(parseManagementReply('gc/1 paired hub=1a2b3c4d')).toBeUndefined()
    expect(parseManagementReply('gc/1 something id=a1b2c3')).toBeUndefined()
    expect(parseManagementReply('tally-ho "x"')).toBeUndefined()
  })
})
