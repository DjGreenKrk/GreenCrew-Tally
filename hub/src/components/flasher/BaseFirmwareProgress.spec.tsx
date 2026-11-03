import { getSteps } from './BaseFirmwareProgress'
import { BaseFirmwareProgressType } from '../../flasher/EsptoolFlasher'

const initial: BaseFirmwareProgressType = {
  inititalizeDone: false,
  connectionDone: false,
  eraseDone: false,
  writePercent: 0,
  writeDone: false,
  allDone: false,
  error: false,
}

describe('BaseFirmwareProgress steps', () => {
  it('renders the initial step without progress instead of dereferencing undefined', () => {
    const steps = getSteps(undefined)
    expect(steps[0]).toMatchObject({ active: true, done: false, error: false, skipped: false })
    expect(steps[2]).toMatchObject({ done: false, skipped: false })
    expect(steps.every(step => step.error === false)).toBe(true)
  })

  it('advances through connection, erase and a partial write without marking later stages skipped', () => {
    const steps = getSteps({ ...initial, inititalizeDone: true, connectionDone: true, eraseDone: true, writePercent: 42 })
    expect(steps[3]).toMatchObject({ active: true, current: 42, max: 100, done: false })
    expect(steps.every(step => step.skipped === false)).toBe(true)
    expect(getSteps({ ...initial, inititalizeDone: true, connectionDone: true, eraseDone: true, writePercent: 100, writeDone: true })[3].done).toBe(true)
  })

  it('flags only the failed stage and skips stages after it', () => {
    const steps = getSteps({ ...initial, inititalizeDone: true, connectionDone: true, error: true })
    expect(steps[1]).toMatchObject({ done: true, error: false, skipped: false })
    expect(steps[2]).toMatchObject({ active: true, error: true, skipped: false })
    expect(steps.slice(3).every(step => step.skipped && !step.active && !step.error)).toBe(true)
  })
})
