import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, makeStyles, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { useEffect, useState } from 'react'
import EditSettingsIni from '../components/EditSettingsIni';
import Layout from '../components/layout/Layout'
import MiniPage from '../components/layout/MiniPage';
import Spinner from '../components/layout/Spinner';
import TallySettingsIniProgress from '../components/flasher/TallySettingsProgress';
import { TallyProgramProgressType, TallySettingsIniProgressType } from '../flasher/NodeMcuConnector';
import TallyDevice, { TallyDeviceObjectType } from '../flasher/TallyDevice';
import TallySettingsIni from '../flasher/TallySettingsIni';
import RefreshIcon from '@material-ui/icons/Refresh';
import { socket } from '../hooks/useSocket';
import Help from '../components/flasher/Help';
import ProgramProgress from '../components/flasher/ProgramProgress';
import PortSelect, { needsPortChoice } from '../components/flasher/PortSelect';
import { useTranslation } from '../i18n';

const useStyles = makeStyles(theme => {
  return {
    warning: {
      marginBottom: theme.spacing(2),
    },
    success: {
      marginBottom: theme.spacing(2),
    },
    footer: {
      borderTop: "solid 1px " + theme.palette.background.default,
      margin: theme.spacing(0, -2),
      padding: theme.spacing(2, 2, 0, 2),
      textAlign: "right",
    },
  }
})

function useTallyDevice(i: number, requestedPath?: string) {
  const [tallyDevice, setTallyDevice] = useState<TallyDevice>(undefined)

  useEffect(() => {
    const onFlasherDevice = (device: TallyDeviceObjectType) => {
      setTallyDevice(TallyDevice.fromJson(device))
    }
    socket.on('flasher.device', onFlasherDevice)

    setTallyDevice(undefined)
    socket.emit('flasher.device.get', requestedPath)
    return () => {
      socket.off('flasher.device', onFlasherDevice)
    }
  }, [i, requestedPath])

  return tallyDevice
}

const FlasherPage = () => {
  // every increment will refresh tallyDevice
  const [increment, setIncrement] = useState<number>(1)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadingOpen, setUploadingOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<TallySettingsIniProgressType>(undefined)
  const [programProgress, setProgramProgress] = useState<TallyProgramProgressType>(undefined)
  // undefined: let the Hub pick the first known ESP USB adapter
  const [requestedPath, setRequestedPath] = useState<string>(undefined)
  const tallyDevice = useTallyDevice(increment, requestedPath)
  const isLoading = tallyDevice === undefined

  const classes = useStyles()
  const { t } = useTranslation()

  const handleReload = () => {
    setIncrement(increment + 1)
  }

  const handleSettingsIniSave = (tallySettings: TallySettingsIni) => {
    setUploadProgress(undefined)
    setProgramProgress(undefined)
    setIsUploading(true)
    setUploadingOpen(true)
    const fnc = (progress: TallySettingsIniProgressType) => {
      if (progress.allDone || progress.error) {
        socket.off('flasher.settingsIni.progress', fnc)
        setIsUploading(false)
        if(!progress.error) { handleReload() }
      }
      setUploadProgress(progress)
    }
    socket.on('flasher.settingsIni.progress', fnc)
    socket.emit('flasher.settingsIni', tallyDevice.path, tallySettings.toString())
  }
  
  const handleProgram = () => {
    setUploadProgress(undefined)
    setProgramProgress(undefined)
    setIsUploading(true)
    setUploadingOpen(true)
    const fnc = (progress: TallyProgramProgressType) => {
      if (progress.allDone || progress.error) {
        socket.off('flasher.program.progress', fnc)
        setIsUploading(false)
        if(!progress.error) { handleReload() }
      }
      setProgramProgress(progress)
    }
    socket.on('flasher.program.progress', fnc)
    socket.emit('flasher.program', tallyDevice.path)
  }

  return (
    <Layout testId="flasher">
      <Dialog
        data-testid="progress"
        disableBackdropClick={isUploading}
        disableEscapeKeyDown={isUploading}
        open={uploadingOpen}
      >
        <DialogTitle>{t('flasher.upload')}</DialogTitle>
        <DialogContent>
          { uploadProgress && <TallySettingsIniProgress progress={uploadProgress} /> }
          { programProgress && <ProgramProgress progress={programProgress} /> }
        </DialogContent>
        <DialogActions>
          <Button data-testid="progress-close" disabled={isUploading} onClick={() => setUploadingOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
      <MiniPage title={t('flasher.title')} addHeaderContent={<IconButton aria-label={t('flasher.reload')} disabled={isLoading || isUploading} onClick={handleReload}><RefreshIcon /></IconButton>}>
        <Typography paragraph>
          {t('flasher.description')}
        </Typography>
        { tallyDevice === undefined ? (
          <Spinner />
        ) : (<>
          { needsPortChoice(tallyDevice.ports, requestedPath) && <PortSelect
            ports={tallyDevice.ports}
            value={tallyDevice.path}
            disabled={isUploading}
            onChange={setRequestedPath}
          /> }
          <Help tallyDevice={tallyDevice} onReload={handleReload} />
        </>)}
      </MiniPage>
      { (tallyDevice?.update === "updateable" || tallyDevice?.update === "up-to-date") && <MiniPage testId="update-software" title={t('flasher.update.title')}>
        { tallyDevice?.update === "up-to-date" && <Alert
          className={classes.success}
          variant="outlined"
          severity="success">
            {t('flasher.update.upToDate')}
        </Alert>}
        { tallyDevice?.update === "updateable" && <>
          <Alert 
            className={classes.warning} 
            severity="warning"
            variant="outlined"
          >
            {t('flasher.update.available')}
          </Alert>
          <div className={classes.footer}>
            <Button color="primary" variant="contained" onClick={handleProgram} data-testid="update-software-now">{t('flasher.update.now')}</Button>
          </div>
        </>}
      </MiniPage>}
      { tallyDevice?.nodeMcuVersion !== undefined && <MiniPage title={t('flasher.ini.title')} testId="tally-settings">
        { !tallyDevice.tallySettings && <Alert 
          className={classes.warning} 
          severity="warning"
          variant="outlined"
        >
          {t('flasher.ini.missing')}
        </Alert> }
        <EditSettingsIni settingsIni={tallyDevice.tallySettings} onSave={handleSettingsIniSave} disabled={isLoading || isUploading} />
      </MiniPage>}
    </Layout>
  )
}
export default FlasherPage;