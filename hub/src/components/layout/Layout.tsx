import React from 'react'
import { makeStyles } from "tss-react/mui"
import { AppBar, Button, Container, Toolbar, Typography } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { buildInfo } from '../../buildInfo'
import useVmixProject from '../../hooks/useVmixProject'
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

const Layout = ({testId: cypressId, children}: LayoutProps) => {
  const { classes } = useStyles()
  const { pathname } = useLocation()
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
        <Button className={classes.navButton} component={RouterLink} to="/" color={isActive('/')} aria-current={isActive('/') === 'primary' ? 'page' : undefined}>{t('nav.tallies')}</Button>
        <Button className={classes.navButton} component={RouterLink} to="/control" color={isActive('/control')} aria-current={isActive('/control') === 'primary' ? 'page' : undefined}>{t('nav.control')}</Button>
        <Button className={classes.navButton} component={RouterLink} to="/config" color={isActive('/config')} aria-current={isActive('/config') === 'primary' ? 'page' : undefined}>{t('nav.config')}</Button>
        <Button className={classes.navButton} component={RouterLink} to="/flasher" color={isActive('/flasher')} aria-current={isActive('/flasher') === 'primary' ? 'page' : undefined}>{t('nav.flash')}</Button>
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
    { children && (<Container maxWidth={false} className={classes.contentContainer} children={children} />) }
  </div>)
}

export default Layout;