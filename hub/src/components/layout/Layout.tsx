import React from 'react'
import { makeStyles } from "tss-react/mui"
import { Alert, AppBar, BottomNavigation, BottomNavigationAction, Button, Container, Paper, Toolbar, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import SensorsIcon from '@mui/icons-material/Sensors'
import TuneIcon from '@mui/icons-material/Tune'
import SettingsIcon from '@mui/icons-material/Settings'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { buildInfo } from '../../buildInfo'
import useVmixProject from '../../hooks/useVmixProject'
import useSocketInfo from '../../hooks/useSocketInfo'
import { socket } from '../../hooks/useSocket'
import { useTranslation } from '../../i18n'
import LanguageSwitch from './LanguageSwitch'

const useStyles = makeStyles()(theme => {
  return {
    // phones: the menu wraps instead of overflowing, the extras are left out
    toolbar: {
      flexWrap: 'wrap',
    },
    navButton: {
      [theme.breakpoints.down('sm')]: {
        minWidth: 44,
        padding: theme.spacing(0.75, 1),
      },
    },
    hideOnPhone: {
      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    },
    brand: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 44,
      color: 'inherit',
      textDecoration: 'none',
    },
    logo: {
      height: 40,
      margin: theme.spacing(1, 1, 1, 0)
    },
    productName: {
      marginRight: theme.spacing(2),
      whiteSpace: 'nowrap',
    },
    contentContainer: {
      marginTop: theme.spacing(2),
    },
    // phones: keep the content clear of the fixed bottom bar
    contentContainerWithBottomNav: {
      paddingBottom: `calc(${theme.spacing(2)} + 56px + env(safe-area-inset-bottom, 0px))`,
    },
    offlineBanner: {
      borderRadius: 0,
      alignItems: 'center',
    },
    bottomNav: {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: theme.zIndex.appBar,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      borderRadius: 0,
      borderTop: `1px solid ${theme.palette.divider}`,
    },
    bottomNavAction: {
      minWidth: 48,
      minHeight: 56,
    },
    buildInfo: {
      marginLeft: 'auto',
      textAlign: 'right',
      whiteSpace: 'nowrap',
    },
    language: {
      marginLeft: theme.spacing(2),
      [theme.breakpoints.down('sm')]: {
        marginLeft: 'auto',
      },
    },
    projectInfo: {
      marginLeft: theme.spacing(2),
      textAlign: 'right',
      whiteSpace: 'nowrap',
    },
  }
})

type LayoutProps = {
  testId: string // this makes it easy in cypress to determine on which page we are
  children?: React.ReactNode
}

// which bottom navigation item is highlighted: the tally pages belong to "Tallies",
// unknown pages and the about page highlight nothing
const selectedNavItem = (pathname: string): string | false => {
  if (pathname === '/' || pathname === '/tally' || pathname.startsWith('/tally/')) return '/'
  for (const to of ['/control', '/config', '/flasher']) {
    if (pathname === to || pathname.startsWith(`${to}/`)) return to
  }
  return false
}

const Layout = ({testId: cypressId, children}: LayoutProps) => {
  const { classes } = useStyles()
  const { pathname } = useLocation()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const isHubConnected = useSocketInfo()
  const { t, language } = useTranslation()
  const buildDate = buildInfo.builtAt ? new Date(buildInfo.builtAt).toLocaleString(language) : t('common.developmentBuild')
  const vmixProject = useVmixProject()
  const projectStatus = vmixProject.hasUnsavedChanges ? t('project.unsaved') : (vmixProject.hasSavedConfiguration ? t('project.saved') : t('project.notSaved'))

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to)) ? 'primary' : 'inherit'

  return (<div data-testid={`page-${cypressId}`}>
    <AppBar position="static">
      <Toolbar className={classes.toolbar}>
        <RouterLink to="/about" className={classes.brand} aria-label={t('nav.about')}>
          <img width="40" height="40" className={classes.logo} src="/favicon.svg" alt="" />
          <Typography variant="h6" component="span" className={`${classes.productName} ${classes.hideOnPhone}`}>GC Tally</Typography>
        </RouterLink>
        {!isPhone && <>
        <Button className={classes.navButton} component={RouterLink} to="/" color={isActive('/')} aria-current={isActive('/') === 'primary' ? 'page' : undefined}>{t('nav.tallies')}</Button>
        <Button className={classes.navButton} component={RouterLink} to="/control" color={isActive('/control')} aria-current={isActive('/control') === 'primary' ? 'page' : undefined}>{t('nav.control')}</Button>
        <Button className={classes.navButton} component={RouterLink} to="/config" color={isActive('/config')} aria-current={isActive('/config') === 'primary' ? 'page' : undefined}>{t('nav.config')}</Button>
        <Button className={classes.navButton} component={RouterLink} to="/flasher" color={isActive('/flasher')} aria-current={isActive('/flasher') === 'primary' ? 'page' : undefined}>{t('nav.flash')}</Button>
        </>}
        {vmixProject.projectName && <Typography variant="caption" className={classes.projectInfo}>
          {t('project.info', { name: vmixProject.projectName, status: projectStatus })}
        </Typography>}
        {vmixProject.projectName && <Button size="small" onClick={() => socket.emit('vmix.project.save')}>{t('project.save')}</Button>}
        <Typography variant="caption" className={`${classes.buildInfo} ${classes.hideOnPhone}`}>
          {t('common.build', { version: buildInfo.version, date: buildDate })}
        </Typography>
        <div className={classes.language}><LanguageSwitch /></div>
      </Toolbar>
    </AppBar>
    {!isHubConnected && (
      <Alert severity="warning" variant="filled" icon={<WifiOffIcon />} role="alert" className={classes.offlineBanner} data-testid="hub-offline-banner">
        {t('layout.hubOffline')}
      </Alert>
    )}
    { children && (<Container maxWidth={false} className={`${classes.contentContainer} ${isPhone ? classes.contentContainerWithBottomNav : ''}`} children={children} />) }
    {isPhone && (
      <Paper component="nav" elevation={8} className={classes.bottomNav} aria-label={t('nav.main')} data-testid="bottom-navigation">
        <BottomNavigation showLabels value={selectedNavItem(pathname)}>
          <BottomNavigationAction className={classes.bottomNavAction} component={RouterLink} to="/" value="/" label={t('nav.tallies')} icon={<SensorsIcon />} />
          <BottomNavigationAction className={classes.bottomNavAction} component={RouterLink} to="/control" value="/control" label={t('nav.control')} icon={<TuneIcon />} />
          <BottomNavigationAction className={classes.bottomNavAction} component={RouterLink} to="/config" value="/config" label={t('nav.config')} icon={<SettingsIcon />} />
          <BottomNavigationAction className={classes.bottomNavAction} component={RouterLink} to="/flasher" value="/flasher" label={t('nav.flash')} icon={<FlashOnIcon />} />
        </BottomNavigation>
      </Paper>
    )}
  </div>)
}

export default Layout;