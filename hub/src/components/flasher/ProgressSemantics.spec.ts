import { getSteps as getProgramSteps } from './ProgramProgress'
import { getSteps as getSettingsSteps } from './TallySettingsProgress'

describe('USB flasher progress semantics (simulated state only)', () => {
  test('program steps do not skip unfinished steps in a healthy operation', () => {
    const steps = getProgramSteps({
      inititalizeDone: true, connectionDone: true,
      filesUploaded: 1, filesTotal: 3,
      rebootDone: false, allDone: false, error: false,
    })
    expect(steps.map(step => step.active)).toEqual([false, false, true, false, false])
    expect(steps.every(step => !step.skipped && !step.error)).toBe(true)
    expect(steps[2].current).toBe(1)
    expect(steps[2].max).toBe(3)
  })

  test('a failed program upload marks only the current step as error and quarantines later steps', () => {
    const steps = getProgramSteps({
      inititalizeDone: true, connectionDone: true,
      filesUploaded: 1, filesTotal: 3,
      rebootDone: false, allDone: false, error: true,
    })
    expect(steps.map(step => step.error)).toEqual([false, false, true, false, false])
    expect(steps.map(step => step.skipped)).toEqual([false, false, false, true, true])
  })

  test('initial state never reports upload finished merely because counters are absent', () => {
    const steps = getProgramSteps()
    expect(steps[2].done).toBe(false)
    expect(steps[0].active).toBe(true)
    expect(steps.every(step => !step.skipped && !step.error)).toBe(true)
  })

  test('settings upload preserves normal progression until actual device reconnection', () => {
    const progress = {
      tallyName: 'Camera', inititalizeDone: true, connectionDone: true,
      uploadDone: true, rebootDone: true, allDone: true, error: false,
    }
    const waiting = getSettingsSteps(progress, false)
    expect(waiting.slice(0, 5).every(step => step.done)).toBe(true)
    expect(waiting[5]).toMatchObject({done: false, active: true, error: false, skipped: false})
    const connected = getSettingsSteps(progress, true)
    expect(connected.every(step => step.done && !step.active && !step.error && !step.skipped)).toBe(true)
  })

  test('settings upload error does not manufacture completed steps', () => {
    const steps = getSettingsSteps({
      tallyName: 'Camera', inititalizeDone: true, connectionDone: false,
      uploadDone: false, rebootDone: false, allDone: false, error: true,
    }, false)
    expect(steps[1]).toMatchObject({active: true, error: true, skipped: false})
    expect(steps.slice(2).every(step => !step.done && step.skipped && !step.active)).toBe(true)
  })
})
