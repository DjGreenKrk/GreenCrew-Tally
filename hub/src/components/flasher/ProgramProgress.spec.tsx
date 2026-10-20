import { getSteps } from './ProgramProgress'
import { TallyProgramProgressType } from '../../flasher/NodeMcuConnector'

const initial: TallyProgramProgressType = {
  inititalizeDone: false,
  connectionDone: false,
  filesUploaded: 0,
  filesTotal: 8,
  rebootDone: false,
  allDone: false,
  error: false,
}

describe('ProgramProgress steps', () => {
  it('renders the initial step without progress instead of dereferencing undefined', () => {
    const steps = getSteps(undefined)
    expect(steps[0]).toMatchObject({ active: true, done: false, error: false, skipped: false })
    expect(steps[2]).toMatchObject({ done: false, skipped: false })
    expect(steps.every(step => step.error === false)).toBe(true)
  })

  it('advances through all stages without marking later stages skipped', () => {
    const steps = getSteps({ ...initial, inititalizeDone: true, connectionDone: true, filesUploaded: 3 })
    expect(steps[2]).toMatchObject({ active: true, current: 3, max: 8, done: false })
    expect(steps.every(step => step.skipped === false)).toBe(true)
    expect(getSteps({ ...initial, inititalizeDone: true, connectionDone: true, filesUploaded: 8 })[2].done).toBe(true)
  })

  it('flags only the failed stage and skips stages after it', () => {
    const steps = getSteps({ ...initial, inititalizeDone: true, error: true })
    expect(steps[0]).toMatchObject({ done: true, error: false, skipped: false })
    expect(steps[1]).toMatchObject({ active: true, error: true, skipped: false })
    expect(steps.slice(2).every(step => step.skipped && !step.active && !step.error)).toBe(true)
  })
})
