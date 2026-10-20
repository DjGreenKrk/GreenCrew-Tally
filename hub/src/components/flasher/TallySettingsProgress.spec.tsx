import { getSteps } from './TallySettingsProgress'
import { TallySettingsIniProgressType } from '../../flasher/NodeMcuConnector'

const initial: TallySettingsIniProgressType = {
  tallyName: 'camera-1',
  inititalizeDone: false,
  connectionDone: false,
  uploadDone: false,
  rebootDone: false,
  allDone: false,
  error: false,
}

describe('TallySettingsProgress steps', () => {
  it('does not skip pending steps while progress is missing', () => {
    const steps = getSteps(undefined, false)
    expect(steps[0]).toMatchObject({ active: true, error: false })
    expect(steps.every(step => !step.skipped)).toBe(true)
  })

  it('waits for the real tally connection after upload', () => {
    const complete = { ...initial, inititalizeDone: true, connectionDone: true, uploadDone: true, rebootDone: true, allDone: true }
    expect(getSteps(complete, false)[5]).toMatchObject({ active: true, done: false, error: false })
    expect(getSteps(complete, true)[5]).toMatchObject({ active: false, done: true, error: false })
  })

  it('keeps failure local to the active step and marks only following stages skipped', () => {
    const steps = getSteps({ ...initial, inititalizeDone: true, connectionDone: true, error: true }, false)
    expect(steps[2]).toMatchObject({ active: true, error: true, skipped: false })
    expect(steps.slice(3).every(step => step.skipped && !step.active && !step.error)).toBe(true)
    expect(steps.slice(0, 2).every(step => !step.skipped && !step.error)).toBe(true)
  })
})
