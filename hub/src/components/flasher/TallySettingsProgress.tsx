import React from 'react'
import { TallySettingsIniProgressType } from '../../flasher/NodeMcuConnector'
import useTallies from '../../hooks/useTallies'
import StepDisplay, { StepType } from './StepDisplay'

export function getSteps(progress: TallySettingsIniProgressType | undefined, isTallyConnected: boolean): StepType[] {
  const steps: Array<Pick<StepType, 'id' | 'label' | 'done'>> = [
    { id: 'initialize', label: 'Initializing', done: Boolean(progress?.inititalizeDone) },
    { id: 'connection', label: 'Establishing connection', done: Boolean(progress?.connectionDone) },
    { id: 'upload', label: 'Uploading tally-settings.ini', done: Boolean(progress?.uploadDone) },
    { id: 'reboot', label: 'Rebooting Tally to apply settings', done: Boolean(progress?.rebootDone) },
    { id: 'done', label: 'Upload Done', done: Boolean(progress?.allDone) },
    { id: 'connected', label: 'Tally is connected to Hub', done: Boolean(progress?.allDone && isTallyConnected) },
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
  const tallies = useTallies()
  const isTallyConnected = !!tallies.find(tally => tally.name === progress?.tallyName && tally.isConnected())

  const steps = getSteps(progress, isTallyConnected)
  
  return <StepDisplay steps={steps} />
}

export default TallySettingsIniProgress


