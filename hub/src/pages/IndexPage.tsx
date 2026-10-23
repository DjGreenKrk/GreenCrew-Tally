import React, { useState } from 'react'
import { makeStyles } from "tss-react/mui"
import useSocketInfo from '../hooks/useSocketInfo'
import useMixerInfo from '../hooks/useMixerInfo'
import Layout from '../components/layout/Layout'
import Tally from '../domain/Tally'
import useTallies from '../hooks/useTallies'
import TallyComponent from '../components/Tally'
import { Box, Button, ButtonGroup, Tooltip, Typography } from '@mui/material'
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'
import WifiIcon from '@mui/icons-material/Wifi'
import ServerIcon from '@mui/icons-material/Dns';
import { Alert, AlertTitle } from '@mui/material'
import TallyCreate from '../components/TallyCreate'
import { useTranslation } from '../i18n'


const useStyles = makeStyles()(theme => {
  return {
    buttons: {
      display: "block",
      marginBottom: theme.spacing(2),
    },
    button: {
      textTransform: "none",
    },
    buttonIcon: {
      marginRight: theme.spacing(1)
    },
    alert: {
      marginBottom: theme.spacing(2)
    },
  }
})

const countConnectedTallies = tallies => {
  if(!tallies) { return null }
  return tallies.reduce((count, tally) => count + (Tally.fromJson(tally).isConnected() ? 1 : 0), 0)
}

const createTallyList = (tallies: Tally[]|null, showDisconnected: boolean, showUnpatched: boolean) => {
  if(!tallies) { return null }
  return tallies.filter(
    tally => (tally.isActive() || showDisconnected) && (tally.isPatched() || showUnpatched)
  ).sort(
    (one, two) => {
      if (one.isActive() !== two.isActive()) {
        return one.isActive() ? -1 : 1
      } else {
        return one.name.localeCompare(two.name)
      }
    }
  )
}

const IndexPage = () => {
  const rawTallies = useTallies()
  const [showDisconnected, setShowDisconnected] = useState(true)
  const [showUnpatched, setShowUnpatched] = useState(true)
  const isMixerConnected = useMixerInfo()
  const isHubConnected = useSocketInfo()
  const { classes } = useStyles()
  const { t } = useTranslation()

  const tallies = createTallyList(rawTallies, showDisconnected, showUnpatched)

  const toggleDisconnected = () => {
    setShowDisconnected(!showDisconnected)
  }

  const toggleUnpatched = () => {
    setShowUnpatched(!showUnpatched)
  }

  const nrConnectedTallies = countConnectedTallies(tallies)

  return (
    <Layout testId="index">
      <div className={classes.buttons}>
        <ButtonGroup size="small" variant="contained">
          <Button data-testid="toggle-disconnected" className={classes.button} color={showDisconnected ? "primary" : "inherit"} onClick={toggleDisconnected}>{t('index.showDisconnected')}</Button>
          <Button data-testid="toggle-unpatched" className={classes.button} color={showUnpatched ? "primary" : "inherit"} onClick={toggleUnpatched}>{t('index.showUnpatched')}</Button>
          <Tooltip title={isHubConnected ? t('index.hubConnected') : t('index.hubDisconnected')}>
            <Button data-testid="hub-connected" className={classes.button} color="inherit" variant="outlined"><DesktopWindowsIcon className={classes.buttonIcon} /> {isHubConnected ? 1 : 0}</Button>
          </Tooltip>
          <Tooltip title={isMixerConnected ? t('index.mixerConnected') : t('index.mixerDisconnected')}>
            <Button data-testid="mixer-connected" className={classes.button} color="inherit" variant="outlined"><ServerIcon className={classes.buttonIcon} /> {isMixerConnected ? 1 : 0}</Button>
          </Tooltip>
          <Tooltip title={t('index.talliesConnected', { count: String(nrConnectedTallies) })}>
            <Button data-testid="tallies-connected" className={classes.button} color="inherit" variant="outlined"><WifiIcon className={classes.buttonIcon} /> {nrConnectedTallies === null ? "?" : nrConnectedTallies}</Button>
          </Tooltip>
        </ButtonGroup>
      </div>
      { isHubConnected ? "" : (
        <Alert severity="error" className={classes.alert}>
          <AlertTitle>{t('index.alert.title')}</AlertTitle>
          <Typography sx={{ mb: 2 }}>{t('index.alert.outdated')}</Typography>
          <Typography>{t('index.alert.reconnect')}</Typography>
        </Alert>
      )}
      <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-start", alignItems: "stretch", alignContent: "flex-start" }}><>
        {tallies ? tallies.map(tally => <TallyComponent tally={tally} key={tally.name} />) : "" /* @TODO: loading */}
        <TallyCreate />
      </></Box>
    </Layout>
  )
}

export default IndexPage;