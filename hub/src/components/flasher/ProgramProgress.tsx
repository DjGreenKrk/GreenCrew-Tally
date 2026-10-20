import React from 'react'
import { TallyProgramProgressType } from '../../flasher/NodeMcuConnector'
import StepDisplay, { StepType } from './StepDisplay'

export function getSteps(progress?: TallyProgramProgressType): StepType[] {
  const steps: Array<Pick<StepType, 'id' | 'label' | 'done'> & Partial<Pick<StepType, 'current' | 'max'>>> = [
    { id: 'initialize', label: 'Initializing', done: Boolean(progress?.inititalizeDone) },
    { id: 'connection', label: 'Establishing connection', done: Boolean(progress?.connectionDone) },
    {
      id: 'upload',
      label: 'Uploading files',
      current: progress?.filesUploaded,
      max: progress?.filesTotal,
      done: Boolean(progress && progress.filesTotal === progress.filesUploaded),
    },
    { id: 'reboot', label: 'Rebooting Tally to apply settings', done: Boolean(progress?.rebootDone) },
    { id: 'done', label: 'Upload Done', done: Boolean(progress?.allDone) },
  ]

  let precedingDone = true
  let previousError = false
  return steps.map(step => {
    const active = precedingDone && !step.done && !previousError
    const error = active && Boolean(progress?.error)
    const skipped = previousError
    precedingDone = precedingDone && step.done
    previousError = previousError || error
    return { ...step, active, error, skipped }
  })
}

type Props = {
  progress?: TallyProgramProgressType
}
function ProgramProgress({progress} : Props) {
  const steps = getSteps(progress)

  return <StepDisplay steps={steps} />
}

export default ProgramProgress


