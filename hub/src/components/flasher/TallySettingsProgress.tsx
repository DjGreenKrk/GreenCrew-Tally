import React from 'react'
import { TallySettingsIniProgressType } from '../../flasher/NodeMcuConnector'
import useTallies from '../../hooks/useTallies'
import StepDisplay, { StepType } from './StepDisplay'
import { TranslateFunction, tStored, useTranslation } from '../../i18n'

export function getSteps(progress: TallySettingsIniProgressType | undefined, isTallyConnected: boolean, t: TranslateFunction = tStored): StepType[] {
  const steps: Array<Pick<StepType, 'id' | 'label' | 'done'>> = [
    { id: 'initialize', label: t('flasher.step.initializing'), done: Boolean(progress?.inititalizeDone) },
    { id: 'connection', label: t('flasher.step.connection'), done: Boolean(progress?.connectionDone) },
    { id: 'upload', label: t('flasher.step.uploadingIni'), done: Boolean(progress?.uploadDone) },
    { id: 'reboot', label: t('flasher.step.reboot'), done: Boolean(progress?.rebootDone) },
    { id: 'done', label: t('flasher.step.done'), done: Boolean(progress?.allDone) },
    { id: 'connected', label: t('flasher.step.connected'), done: Boolean(progress?.allDone && isTallyConnected) },
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
  progress?: TallySettingsIniProgressType
}
function TallySettingsIniProgress({progress} : Props) {
  const { t } = useTranslation()
  const tallies = useTallies()
  const isTallyConnected = !!tallies.find(tally => tally.name === progress?.tallyName && tally.isConnected())

  const steps = getSteps(progress, isTallyConnected, t)
  
  return <StepDisplay steps={steps} />
}

export default TallySettingsIniProgress


