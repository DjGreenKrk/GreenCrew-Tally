import { FormHelperText } from '@mui/material'
import { makeStyles } from "tss-react/mui"
import React from 'react'
import { Color, ColorScheme, CUSTOM_COLOR_CHANNELS, CustomColorChannel } from '../../tally/ColorScheme'
import { TranslationKey, useTranslation } from '../../i18n'

const useStyle = makeStyles()((theme) => ({
  grid: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
  },
  swatch: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  input: {
    width: "48px",
    height: "32px",
    border: "solid 1px " + theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    padding: 0,
    background: "none",
  },
  label: {
    textAlign: "center",
  },
}))

type CustomColorEditorProps = {
  value: ColorScheme
  onChange: (channel: CustomColorChannel, color: Color) => void
  disabled?: boolean
  testId: string
}

function CustomColorEditor({ value, onChange, disabled, testId }: CustomColorEditorProps) {
  const { classes } = useStyle()
  const { t } = useTranslation()

  return (
    <div data-testid={testId}>
      <div className={classes.grid}>
        {CUSTOM_COLOR_CHANNELS.map(channel => (
          <div className={classes.swatch} key={channel}>
            <input
              type="color"
              className={classes.input}
              data-testid={`${testId}-${channel}`}
              value={value[channel].toHex()}
              disabled={disabled}
              onChange={(e) => onChange(channel, Color.fromHex(e.target.value))}
            />
            <FormHelperText disabled={true} className={classes.label}>{t(`colorScheme.${channel}` as TranslationKey)}</FormHelperText>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CustomColorEditor
