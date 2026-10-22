import React from 'react'
import { Button, makeStyles } from '@material-ui/core'
import TallyDevice from '../../flasher/TallyDevice'
import { Alert, AlertTitle } from '@material-ui/lab'
import ExternalLink from '../ExternalLink'
import { useTranslation } from '../../i18n'

const useStyles = makeStyles(theme => {
  return {
    warning: {
      marginBottom: theme.spacing(2),
    },
    info: {
      marginBottom: theme.spacing(2),
      "& a": {
        color: theme.palette.info.main,
      }
    }
  }
})

type Props = {
  tallyDevice: TallyDevice
  onReload: () => void
}

function Help({tallyDevice, onReload}: Props) {
  const classes = useStyles()
  const { t } = useTranslation()
  
  if (tallyDevice.path === undefined) {
    const isLocalhost = (() => {
      const hostName = window.location.hostname
      return hostName === "127.0.0.1" || hostName === "localhost" || hostName === "[::1]"
    })

    return <>
      <Alert 
        className={classes.warning} 
        severity="warning"
        action={
          <Button color="inherit" size="small" onClick={() => onReload()}>{t('flasher.help.tryAgain')}</Button>
        }
      >
        { tallyDevice.ports.length > 0
          ? t('flasher.help.noAdapter')
          : t('flasher.help.noDevice') }
      </Alert>
      <Alert variant="outlined" className={classes.info} severity="info">
        <AlertTitle>{t('flasher.help.fixes')}</AlertTitle>
        <ul>
          <li>{t('flasher.help.fixPlug')}</li>
          { !isLocalhost() && <li>{t('flasher.help.fixLocal')}</li> }
          <li>{t('flasher.help.fixCable')}</li>
          <li>{t('flasher.help.fixClose')}</li>
          <li>{t('flasher.help.fixDriversBefore')}<ExternalLink href="https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers">{t('flasher.help.fixDriversLink')}</ExternalLink>{t('flasher.help.fixDriversAfter')}</li>
        </ul>
      </Alert>
    </>
  } else if (tallyDevice.nodeMcuVersion === undefined) {
    return <>
      <Alert 
        className={classes.warning} 
        severity="warning"
        action={
          <Button color="inherit" size="small" onClick={() => onReload()}>{t('flasher.help.tryAgain')}</Button>
        }
      >
        {t('flasher.help.noLua', { path: tallyDevice.path })}
        { tallyDevice.errorMessage && <><br />{tallyDevice.errorMessage}</> }
      </Alert>
      <Alert variant="outlined" className={classes.info} severity="info">
        <AlertTitle>{t('flasher.help.fixes')}</AlertTitle>
        <ul>
          <li>{t('flasher.help.fixRetry')}</li>
          <li>{t('flasher.help.fixFirmware')}</li>
          <li>{t('flasher.help.fixReset')}</li>
        </ul>
      </Alert>
    </>
  }
  return <></>
}

export default Help