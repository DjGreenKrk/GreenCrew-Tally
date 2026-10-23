import { FormHelperText, TextField } from '@mui/material'
import { makeStyles } from "tss-react/mui"
import React from 'react'
import ObsConfiguration, { ObsConfigurationLiveMode } from '../ObsConfiguration'
import { TranslationKey, useTranslation } from '../../../i18n'

const useStyles = makeStyles()(theme => {
  return {
    root: {
      marginBottom: theme.spacing(2)
    }
  }
})

type ObsLiveModeSelectProps = {
  label: string
  testId: string
  value: ObsConfigurationLiveMode
  onChange: (value: ObsConfigurationLiveMode) => void
}

const options = {
  always: {
    label: "obs.mode.always" as TranslationKey,
    help: undefined as TranslationKey | undefined,
  },
  stream: {
    label: "obs.mode.stream" as TranslationKey,
    help: "obs.mode.streamHelp" as TranslationKey,
  },
  record: {
    label: "obs.mode.record" as TranslationKey,
    help: "obs.mode.recordHelp" as TranslationKey,
  },
  streamOrRecord: {
    label: "obs.mode.streamOrRecord" as TranslationKey,
    help: "obs.mode.streamOrRecordHelp" as TranslationKey,
  },
}

function ObsLiveModeSelect({label, testId, value, onChange}: ObsLiveModeSelectProps) {
  const { classes } = useStyles()
  const { t } = useTranslation()

  const currentOption = options[value]

  const handleChange = e => {
    const value = e.target.value.toString()
    if (ObsConfiguration.isValidLiveMode(value)) {
      onChange(value)
    }
  }
  return <div className={classes.root}>
    <TextField select data-testid={testId} label={label} value={value} onChange={handleChange}>
      {Object.keys(options).map(key => {
        const label = t(options[key].label)
        return <option key={key} value={key} label={label} />
      })}
    </TextField>
    {currentOption && currentOption.help && (
      <FormHelperText disabled={true}>{t(currentOption.help)}</FormHelperText>
    )}
    
  </div>
}

export default ObsLiveModeSelect
