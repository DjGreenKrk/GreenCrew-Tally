import { Button, Checkbox, FormControlLabel, FormHelperText, Typography } from '@mui/material'
import { makeStyles } from "tss-react/mui"
import React, { useEffect, useState } from 'react'
import { useDefaultTallyConfiguration } from '../../hooks/useConfiguration'
import { socket } from '../../hooks/useSocket'
import { Color, ColorScheme, ColorSchemeId, CustomColorChannel } from '../../tally/ColorScheme'
import { DefaultTallyConfiguration } from '../../tally/TallyConfiguration'
import MiniPage from '../layout/MiniPage'
import Spinner from '../layout/Spinner'
import BrightnessSlider from './BrightnessSlider'
import ColorSchemeSelector from './ColorSchemeSelector'
import CustomColorEditor from './CustomColorEditor'
import { useTranslation } from '../../i18n'

const useStyle = makeStyles()((theme) => ({
  input: {
    margin: theme.spacing(0, 2, 2, 0),
    display: "block",
  },
  footer: {
    borderTop: "solid 1px " + theme.palette.background.default,
    margin: theme.spacing(0, -2),
    padding: theme.spacing(2, 2, 0, 2),
    textAlign: "right",
  },
  checkboxLabel: {
    fontSize: "1em",
  }
}))

function TallySettings() {
  const { t } = useTranslation()
  const settings = useDefaultTallyConfiguration()
  const [operatorBrightness, setOperatorBrightness] = useState<number>(undefined)
  const [stageBrightness, setStageBrightness] = useState<number>(undefined)
  const [operatorColorScheme, setOperatorColorScheme] = useState<ColorSchemeId>(undefined)
  const [stageColorScheme, setStageColorScheme] = useState<ColorSchemeId>(undefined)
  const [stageShowsPreview, setStageShowsPreview] = useState<boolean>(undefined)
  const [stageShowsAux, setStageShowsAux] = useState<boolean>(undefined)
  const [operatorShowsIdle, setOperatorShowsIdle] = useState<boolean>(undefined)
  const [customColorScheme, setCustomColorScheme] = useState<ColorScheme>(undefined)
  useEffect(() => {
    // called when setting changed
    setOperatorBrightness(settings?.getOperatorLightBrightness())
    setStageBrightness(settings?.getStageLightBrightness())
    setOperatorColorScheme(settings?.getOperatorColorScheme())
    setStageColorScheme(settings?.getStageColorScheme())
    setStageShowsPreview(settings?.getStageShowsPreview())
    setStageShowsAux(settings?.getStageShowsAux())
    setOperatorShowsIdle(settings?.getOperatorShowsIdle())
    setCustomColorScheme(settings?.getCustomColorScheme())
  }, [settings])

  const { classes } = useStyle()
  // Wait until the effect above copied the settings into the form: MUI sliders
  // that mount with an undefined value stay uncontrolled and ignore later values.
  const isLoading = !settings || operatorBrightness === undefined

  const handleSubmit = (event) => {
    event.preventDefault()
    if (operatorBrightness !== undefined) settings.setOperatorLightBrightness(operatorBrightness)
    if (stageBrightness !== undefined) settings.setStageLightBrightness(stageBrightness)
    if (operatorColorScheme !== undefined) settings.setOperatorColorScheme(operatorColorScheme)
    if (stageColorScheme !== undefined) settings.setStageColorScheme(stageColorScheme)
    if (stageShowsPreview !== undefined) settings.setStageShowsPreview(stageShowsPreview)
    if (stageShowsAux !== undefined) settings.setStageShowsAux(stageShowsAux)
    if (operatorShowsIdle !== undefined) settings.setOperatorShowsIdle(operatorShowsIdle)
    if (customColorScheme !== undefined) {
      for (const channel of Object.keys(customColorScheme) as (keyof ColorScheme)[]) {
        if (channel === "id" || channel === "name" || channel === "description") continue
        settings.setCustomColor(channel as CustomColorChannel, customColorScheme[channel])
      }
    }

    socket.emit('config.change.tallyconfig', settings.toJson())
  }

  const handleCustomColorChange = (channel: CustomColorChannel, color: Color) => {
    setCustomColorScheme(current => ({ ...current, [channel]: color }))
  }

  return <MiniPage data-testid="tally-defaults" title={t('tallyDefaults.title')}>
    { isLoading ? <Spinner /> : (<form onSubmit={handleSubmit}>
      <div className={classes.input}>
        <Typography sx={{ mb: 2 }} variant="h6">{t('tallySettings.operatorBrightness')}</Typography>
        <BrightnessSlider
          testId="tally-defaults-ob"
          minValue={DefaultTallyConfiguration.minOperatorLightBrightness}
          minMessage={t('tallySettings.operatorMin')}
          value={operatorBrightness} 
          onChange={(value) => {setOperatorBrightness(value)}}
        />
      </div>
      <div className={classes.input}>
        <Typography sx={{ mb: 2 }} variant="h6">{t('tallySettings.operatorColors')}</Typography>
        <ColorSchemeSelector
          testId="tally-defaults-oc"
          value={operatorColorScheme}
          onChange={(value) => {setOperatorColorScheme(value)}}
          customScheme={customColorScheme}
        />
      </div>
      <div className={classes.input}>
        <Typography sx={{ mb: 2 }} variant="h6">{t('tallySettings.operatorDisplay')}</Typography>
        <FormControlLabel
          classes={{label: classes.checkboxLabel}}
          control={<Checkbox
            data-testid="tally-defaults-oi"
            data-value={operatorShowsIdle}
            checked={operatorShowsIdle}
            color="primary"
            onChange={(e) => {setOperatorShowsIdle(e.target.checked)}}
            size="small"
          />}
          label={t('tallySettings.showsIdle')}
        />
      </div>
      <div className={classes.input}>
        <Typography sx={{ mb: 2 }} variant="h6">{t('tallySettings.stageBrightness')}</Typography>
        <BrightnessSlider 
          testId="tally-defaults-sb"
          value={stageBrightness} 
          onChange={(value) => {setStageBrightness(value)}}
        />
      </div>
      <div className={classes.input}>
        <Typography sx={{ mb: 2 }} variant="h6">{t('tallySettings.stageColors')}</Typography>
        <ColorSchemeSelector
          testId="tally-defaults-sc"
          value={stageColorScheme}
          onChange={(value) => {setStageColorScheme(value)}}
          customScheme={customColorScheme}
        />
      </div>
      <div className={classes.input}>
        <Typography sx={{ mb: 2 }} variant="h6">{t('tallySettings.stageDisplay')}</Typography>
        <FormControlLabel
          classes={{label: classes.checkboxLabel}}
          control={<Checkbox
            data-testid="tally-defaults-sp"
            data-value={stageShowsPreview}
            checked={stageShowsPreview}
            color="primary"
            onChange={(e) => {setStageShowsPreview(e.target.checked)}}
            size="small"
          />}
          label={t('tallySettings.showsPreview')}
        />
        <FormControlLabel
          classes={{label: classes.checkboxLabel}}
          control={<Checkbox
            data-testid="tally-defaults-sa"
            data-value={stageShowsAux}
            checked={stageShowsAux}
            color="primary"
            onChange={(e) => {setStageShowsAux(e.target.checked)}}
            size="small"
          />}
          label={t('tallySettings.showsAux')}
        />
      </div>
      <div className={classes.input}>
        <Typography sx={{ mb: 2 }} variant="h6">{t('tallySettings.customColors')}</Typography>
        <FormHelperText disabled={true} sx={{ mb: 1 }}>{t('tallySettings.customColorsHint')}</FormHelperText>
        {customColorScheme && (
          <CustomColorEditor
            testId="tally-defaults-custom"
            value={customColorScheme}
            onChange={handleCustomColorChange}
          />
        )}
      </div>
      <div className={classes.footer}>
        <Button data-testid="tally-defaults-submit" type="submit" variant="contained" color="primary">{t('common.save')}</Button>
      </div>
    </form>)}
  </MiniPage> 
}

export default TallySettings