import React from 'react'
import { TallyProgramProgressType } from '../../flasher/NodeMcuConnector'
import StepDisplay, { StepType } from './StepDisplay'
import { TranslateFunction, tStored, useTranslation } from '../../i18n'

export function getSteps(progress?: TallyProgramProgressType, t: TranslateFunction = tStored): StepType[] {
  const steps: Array<Pick<StepType, 'id' | 'label' | 'done'> & Partial<Pick<StepType, 'current' | 'max'>>> = [
    { id: 'initialize', label: t('flasher.step.initializing'), done: Boolean(progress?.inititalizeDone) },
    { id: 'connection', label: t('flasher.step.connection'), done: Boolean(progress?.connectionDone) },
    {
      id: 'upload',
      label: t('flasher.step.uploadingFiles'),
      current: progress?.filesUploaded,
      max: progress?.filesTotal,
      done: Boolean(progress && progress.filesTotal === progress.filesUploaded),
    },
    { id: 'reboot', label: t('flasher.step.reboot'), done: Boolean(progress?.rebootDone) },
    { id: 'done', label: t('flasher.step.done'), done: Boolean(progress?.allDone) },
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
  const { t } = useTranslation()
  const steps = getSteps(progress, t)

  return <StepDisplay steps={steps} />
}

export default ProgramProgress


