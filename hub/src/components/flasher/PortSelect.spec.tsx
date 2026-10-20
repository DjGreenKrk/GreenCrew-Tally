import { describePort, needsPortChoice } from './PortSelect'

const ftdi = { path: 'COM11', vendorId: '0403', supported: true }
const ch340 = { path: 'COM5', vendorId: '1a86', supported: true }
const builtIn = { path: 'COM1', supported: false }

describe('flasher port choice', () => {
  test('stays hidden when exactly one ESP adapter is connected', () => {
    expect(needsPortChoice([builtIn, ftdi])).toBe(false)
  })

  test('is offered for several ESP adapters or when none is recognised', () => {
    expect(needsPortChoice([ftdi, ch340])).toBe(true)
    expect(needsPortChoice([builtIn])).toBe(true)
    expect(needsPortChoice([])).toBe(false)
  })

  test('stays visible after the user picked an unidentified port', () => {
    expect(needsPortChoice([builtIn, ftdi], 'COM1')).toBe(true)
  })

  test('names the adapter behind each port', () => {
    expect(describePort(ftdi)).toBe('COM11 – FTDI')
    expect(describePort(ch340)).toBe('COM5 – CH340')
    expect(describePort(builtIn)).toBe('COM1 – unknown device')
  })
})
