import React, { useEffect, useState } from 'react'
import { makeStyles } from "tss-react/mui"
import { keyframes } from "tss-react"
import { socket } from '../hooks/useSocket'
import { WebTally, WebTallyObjectType } from '../domain/Tally'
import { CircularProgress, darken, alpha, IconButton, Typography, useTheme } from '@mui/material'
import { useParams } from "react-router-dom"
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import { FullScreen, useFullScreenHandle } from "react-full-screen"
import TuneIcon from '@mui/icons-material/Tune'
import NoSleepJs from 'nosleep.js'
import { StateCommand } from '../tally/CommandCreator'
import PageNotFound from './PageNotFound'
import TallySettings from '../components/TallySettings'
import { useDefaultTallyConfiguration } from '../hooks/useConfiguration'
import ColorSchemes, { Color, ColorScheme } from '../tally/ColorScheme'
import { useTranslation } from '../i18n'

// highlight flashes between the scheme's highlight color and off (black), the
// same on/off the physical tally's flash pattern (0xAA) blinks between.
const HIGHLIGHT_COLOR_VAR = '--tally-highlight-color'

export function resolveTallyVisual(command: StateCommand, colorScheme: ColorScheme): { dataColor: string, color: Color } {
  if (command === "highlight") {
    return { dataColor: "highlight", color: colorScheme.highlight }
  } else if (command === "on-air") {
    return { dataColor: "program", color: colorScheme.program }
  } else if (command === "aux") {
    return { dataColor: "aux", color: colorScheme.aux }
  } else if (command === "preview") {
    return { dataColor: "preview", color: colorScheme.preview }
  } else if (command === "release") {
    return { dataColor: "idle", color: colorScheme.idle }
  } else if (command === "unknown") {
    return { dataColor: "unknown", color: colorScheme.unknown }
  } else {
    // if typescript fails here, we forgot a case
    const unreachable: never = command
    throw new Error(`Unhandled web tally state: ${String(unreachable)}`)
  }
}

const useStyles = makeStyles()((theme) => {
  const highlightFrames = keyframes({
    from: {
      backgroundColor: `var(${HIGHLIGHT_COLOR_VAR}, #fff)`,
      color: alpha(theme.palette.getContrastText('#fff'), 0.7)
    },
    "50%": {
      backgroundColor: '#000',
      color: alpha(theme.palette.getContrastText('#000'), 0.7)
    },
    to: {
      backgroundColor: `var(${HIGHLIGHT_COLOR_VAR}, #fff)`,
      color: alpha(theme.palette.getContrastText('#fff'), 0.7)
    },
    })
  return {
  root: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center", 
    padding: theme.spacing(2),

    backgroundColor: theme.palette.grey[800],
    color: alpha(theme.palette.getContrastText(theme.palette.grey[800]), 0.7)
  },
  highlight: {
    animationName: highlightFrames,
    animationDuration: '0.25s',
    animationTimingFunction: 'step-start',
    animationIterationCount: 'infinite',
    backgroundColor: '#000',
    color: alpha(theme.palette.getContrastText('#000'), 0.7)
  },
  spinner: {
    width: "30vw",
    height: "30vh",
  },
  name: {
    color: "inherit",
    fontSize: "3rem",
    fontWeight: 300,
  },
  fullscreenIcon: {
    color: "inherit",
    position: "absolute",
    bottom: theme.spacing(2),
    right: theme.spacing(2),
  },
  settingsIcon: {
    color: "inherit",
    position: "absolute",
    top: theme.spacing(2),
    right: theme.spacing(2),
  }
  }
})

function useWebTally(tallyName: string) {
  const [tally, setTally] = useState<WebTally>()
  const [command, setCommand] = useState<StateCommand>()
  const [isValid, setIsValid] = useState<boolean>()

  useEffect(() => {
    const onChange = ({tally: tallyData, command} : {tally: WebTallyObjectType, command: StateCommand}) => {
      const tally = WebTally.fromJson(tallyData)
      setTally(tally)
      setCommand(command)
    }
  
    const onInvalid = (theTallyName: string) => {
      if (tallyName === theTallyName) {
        setTally(undefined)
        setCommand(undefined)
        setIsValid(false)
      }
    }

    const onDisconnect = () => {
      socket.off('webTally.state', onChange)
      socket.off('webTally.invalid', onInvalid)
      if (socket.connected) socket.emit('events.webTally.unsubscribe', tallyName)
      setTally(undefined)
      setCommand(undefined)
      setIsValid(true)
    }

    const onConnect = () => {
      socket.emit('events.webTally.subscribe', tallyName)
      socket.on('webTally.state', onChange)
      socket.on('webTally.invalid', onInvalid)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    
    if (socket.connected) onConnect()
    return () => {
      // Release both transport event handlers and the tally subscriptions.
      // Leaving connect/disconnect handlers behind duplicates subscriptions
      // when the page is unmounted or the tallyName route parameter changes.
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      onDisconnect()
    }
  }, [tallyName])

  return {
    tally,
    command,
    isValid,
  }
}

function WebTallyPage() {
  const { tallyId } = useParams<{tallyId: string}>() as { tallyId: string }
  const tallyName = tallyId.replace(/^web-/, "")
  const { tally, command, isValid } = useWebTally(tallyName)
  const defaultTallyConfiguration = useDefaultTallyConfiguration()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isLoading = !tally || !command
  const { classes } = useStyles()
  const theme = useTheme()
  const { t } = useTranslation()
  const handle = useFullScreenHandle()
  // @TODO: nosleep is quite hacky, so use https://caniuse.com/?search=Wake%20Lock%20API sooner or later
  const [noSleep] = useState(new NoSleepJs())
  useEffect(() => {return () => {
    // make sure no-sleep is turned off when unmounted
    noSleep.disable()
  }}, [noSleep])

  if (isValid === false) {
    return <PageNotFound>{t('webTally.notFoundBefore')}<strong>{tallyName}</strong>{t('webTally.notFoundAfter')}</PageNotFound>
  }

  const colorSchemeId = tally?.configuration?.getOperatorColorScheme() || defaultTallyConfiguration?.getOperatorColorScheme() || "default"
  const colorScheme = ColorSchemes.getById(colorSchemeId, defaultTallyConfiguration?.getCustomColorScheme())
  const classRoot: string[] = [classes.root]
  let dataColor = ""
  let bgColor = theme.palette.grey[800]
  let text = ""
  let showSpinner = false
  if (isLoading) {
    dataColor = "loading"
    text = t('webTally.waiting')
    showSpinner = true
  } else {
    const visual = resolveTallyVisual(command, colorScheme)
    dataColor = visual.dataColor
    bgColor = visual.color.toCss()
    if (command === "highlight") {
      classRoot.push(classes.highlight)
      text = t('webTally.highlight')
    } else if (command === "on-air") {
      text = t('webTally.program')
    } else if (command === "aux") {
      text = t('webTally.aux')
    } else if (command === "preview") {
      text = t('webTally.preview')
    } else if (command === "release") {
      text = t('webTally.idle')
    } else if (command === "unknown") {
      text = t('webTally.noMixer')
      showSpinner = true
    }
  }

  const brightness = (tally?.configuration?.getOperatorLightBrightness() || defaultTallyConfiguration?.getOperatorLightBrightness() || 100) / 100
  bgColor = darken(bgColor, 1 - brightness)
  const textColor = theme.palette.getContrastText(bgColor)
  // the flash animation (see highlightFrames) reads its "on" color from this
  // CSS variable instead of a static inline backgroundColor
  const highlightStyle = command === "highlight" ? { [HIGHLIGHT_COLOR_VAR]: bgColor } : undefined

  const enterFullScreen = () => {
    noSleep.enable()
    handle.enter()
  }
  const exitFullScreen = () => {
    noSleep.disable()
    handle.exit()
  }

  return <FullScreen handle={handle}>
    <div data-testid="page-tally-web" data-color={dataColor} data-brightness={brightness} className={classRoot.join(" ")} style={{backgroundColor: bgColor, color: textColor, ...highlightStyle}}>
      { showSpinner ? (
        <CircularProgress className={classes.spinner} color="inherit" size="min(30vw, 30vh)" />
      ) : (<>
        <Typography component="div" variant="h1" className={classes.name}>{(tally && tally.name) || ""}</Typography>
        <IconButton data-testid="tally-settings-link" className={classes.settingsIcon} aria-label={t('webTally.settings')} onClick={() => setSettingsOpen(true)}>
          <TuneIcon />
        </IconButton>
        <TallySettings tally={tally} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        { handle.active ? (
          <IconButton className={classes.fullscreenIcon} aria-label={t('webTally.exitFullscreen')} onClick={exitFullScreen}>
            <FullscreenExitIcon />
          </IconButton>
        ) : (
          <IconButton className={classes.fullscreenIcon} aria-label={t('webTally.enterFullscreen')} onClick={enterFullScreen}>
            <FullscreenIcon />
          </IconButton>
        )}
      </>)}
      { text && <Typography component="div">{text}</Typography>}
      
    </div>
  </FullScreen>
}

export default WebTallyPage
