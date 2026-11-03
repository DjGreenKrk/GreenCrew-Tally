import React from 'react'
import { BaseFirmwareProgressType } from '../../flasher/EsptoolFlasher'
import StepDisplay, { StepType } from './StepDisplay'
import { TranslateFunction, tStored, useTranslation } from '../../i18n'

export function getSteps(progress?: BaseFirmwareProgressType, t: TranslateFunction = tStored): StepType[] {
  const steps: Array<Pick<StepType, 'id' | 'label' | 'done'> & Partial<Pick<StepType, 'current' | 'max'>>> = [
    { id: 'initialize', label: t('flasher.step.initializing'), done: Boolean(progress?.inititalizeDone) },
    { id: 'connection', label: t('flasher.step.connection'), done: Boolean(progress?.connectionDone) },
    { id: 'erase', label: t('flasher.baseFirmware.step.erase'), done: Boolean(progress?.eraseDone) },
    {
      id: 'write',
      label: t('flasher.baseFirmware.step.write'),
      current: progress?.writePercent,
      max: 100,
      done: Boolean(progress?.writeDone),
    },
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
  progress?: BaseFirmwareProgressType
}
function BaseFirmwareProgress({progress} : Props) {
  const { t } = useTranslation()
  const steps = getSteps(progress, t)

  return <StepDisplay steps={steps} />
}

export default BaseFirmwareProgress
