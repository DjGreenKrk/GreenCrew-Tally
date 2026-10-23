import React from 'react'
import { makeStyles } from "tss-react/mui"
import Layout from '../components/layout/Layout'
import MiniPage from '../components/layout/MiniPage'
import useTallyLog from '../hooks/useTallyLog'
import LogType from '../domain/Log'
import { Typography } from '@mui/material'
import Spinner from '../components/layout/Spinner'
import { useParams } from "react-router-dom"
import useTallies from '../hooks/useTallies'
import { useTranslation } from '../i18n'

type LogProps = {
  log: LogType
  idx: number
  classes: ReturnType<typeof useStyles>['classes']
}

const useStyles = makeStyles()(theme => {
  return {
    logLine: {
      fontFamily: "monospace", // @TODO: should be part of the theme
      padding: theme.spacing(1, 2),
    },
    bgStatus: {
      backgroundColor: theme.palette.primary.main,
    },
    bgError: {
      backgroundColor: theme.palette.error.main,
    },
    bgWarning: {
      backgroundColor: theme.palette.warning.main,
    },
    logDate: {
      opacity: "0.5",
      fontSize: "0.8em",
    },
  }
})

const Log = ({log, idx, classes}: LogProps) => {

  const classNames = [classes.logLine]
  if(log.isWarning()) {
    classNames.push(classes.bgWarning)
  } else if (log.isError()) {
    classNames.push(classes.bgError)
  } else if (log.isStatus()) {
    classNames.push(classes.bgStatus)
  }

  return (
    <div data-testid={`log-line-${idx}`} data-severity={log.isWarning() ? "warning" : (log.isError() ? "error" : (log.isStatus() ? "status" : "info"))} key={idx} className={classNames.join(" ")}>
      <time className={classes.logDate}>{log.dateTime.toISOString()}</time><div>{log.message}</div>
    </div>
  )
}

const TallyLogPage = () => {
  const { tallyId } = useParams<{tallyId: string}>() as { tallyId: string }
  const logs = useTallyLog(tallyId)
  const tallies = useTallies()
  const tally = tallies?.find(tally => tally.getId() === tallyId)
  const { classes } = useStyles()
  const { t } = useTranslation()

  return (
    <Layout testId="tally-log">
      <MiniPage title={t('log.title', { name: tally?.name ?? tallyId })} contentPadding="0">
        {logs === undefined ? (
          <Spinner label={t('log.loading')} testId="log-loading" />
        ) : logs.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2 }} data-testid="log-empty">{t('log.empty')}</Typography>
        ) : logs.map((log, idx) => <Log log={log} idx={idx} classes={classes} />)}
      </MiniPage>
    </Layout>
  )
}

export default TallyLogPage;