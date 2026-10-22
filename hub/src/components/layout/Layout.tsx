import React from 'react'
import { AppBar, Button, Container, makeStyles, Toolbar, Typography } from '@material-ui/core'
import { Link as RouterLink } from 'react-router-dom'
import { buildInfo } from '../../buildInfo'
import useVmixProject from '../../hooks/useVmixProject'
import { socket } from '../../hooks/useSocket'

const useStyles = makeStyles(theme => {
  return {
    // phones: the menu wraps instead of overflowing, the extras are left out
    toolbar: {
      flexWrap: 'wrap',
    },
    navButton: {
      [theme.breakpoints.down('xs')]: {
        minWidth: 0,
        padding: theme.spacing(0.75, 1),
      },
    },
    hideOnPhone: {
      [theme.breakpoints.down('xs')]: {
        display: 'none',
      },
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
  const classes = useStyles()
  const buildDate = buildInfo.builtAt ? new Date(buildInfo.builtAt).toLocaleString() : 'Development build'
  const vmixProject = useVmixProject()
  const projectStatus = vmixProject.hasUnsavedChanges ? 'Unsaved changes' : (vmixProject.hasSavedConfiguration ? 'Saved' : 'Not saved')

  return (<div data-testid={`page-${cypressId}`}>
    <AppBar position="static">
      <Toolbar className={classes.toolbar}>
        <img width="40" height="40" className={classes.logo} src="/favicon.svg" alt="" />
        <Typography variant="h6" component="span" className={`${classes.productName} ${classes.hideOnPhone}`}>GC Tally</Typography>
        <Button className={classes.navButton} component={RouterLink} to="/">Tallies</Button>
        <Button className={classes.navButton} component={RouterLink} to="/control">Control</Button>
        <Button className={classes.navButton} component={RouterLink} to="/config">Configuration</Button>
        <Button className={classes.navButton} component={RouterLink} to="/flasher">Flash</Button>
        {vmixProject.projectName && <Typography variant="caption" className={classes.projectInfo}>
          Project: {vmixProject.projectName} | {projectStatus}
        </Typography>}
        {vmixProject.projectName && <Button size="small" onClick={() => socket.emit('vmix.project.save')}>Save project</Button>}
        <Typography variant="caption" className={`${classes.buildInfo} ${classes.hideOnPhone}`}>
          Build {buildInfo.version} | {buildDate}
        </Typography>
      </Toolbar>
    </AppBar>
    { children && (<Container maxWidth={false} className={classes.contentContainer} children={children} />) }
  </div>)
}

export default Layout;