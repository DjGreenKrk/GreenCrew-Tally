import { Button, Dialog, DialogActions, DialogContent, DialogTitle, makeStyles, Paper, TextField, Tooltip, Typography } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import React, { useState } from 'react'
import useChannels from '../hooks/useChannels'
import { socket } from '../hooks/useSocket'
import useTallies from '../hooks/useTallies'
import ChannelSelector from './ChannelSelector'
import { useTranslation } from '../i18n'

const useStyles = makeStyles(theme => {
  return {
    root: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "dashed 1px " + theme.palette.grey[700],
      width: "250px",
      margin: theme.spacing(1),
      padding: theme.spacing(2),
      overflow: "hidden",
      background: "transparent",
    },
    alert: {
      marginBottom: theme.spacing(2),
    },
    formWrapper: {
      margin: "0 auto",
      maxWidth: "250px",
    },
    mb: {
      marginBottom: theme.spacing(2),
    }
  }
})

const createTally = function (tallyName, channelIds) {
  socket.emit('tally.create', tallyName, channelIds)
}

type TallyCreatePopupProps = {
  classes: Record<string, string>
  open: boolean
  onClose: () => void
}

const maxLength = 26 // same as "tally.name" in tally

function TallyCreatePopup({classes, open, onClose}: TallyCreatePopupProps) {
  const { t } = useTranslation()
  const channels = useChannels()
  const tallies = useTallies()
  const [channelIds, setChannelIds] = useState<string[]>([])
  const [name, setName] = useState<string>("");
  const hasUdpTally = !!tallies?.find(tally => tally.isUdpTally())
  
  let errorMessage = ""
  if (name === "") {
    errorMessage = t('tallyCreate.errorName')
  } else if (name.length > maxLength) {
    errorMessage = t('tallyCreate.errorLength', { max: maxLength })
  } else if (tallies?.find(tally => tally.name === name)) {
    errorMessage = t('tallyCreate.errorExists', { name })
  }

  function handleCreate() {
    createTally(name, channelIds)
    onClose()
  }

  return (
    <Dialog data-testid="tally-create-popup" maxWidth="xs" open={open} onClose={onClose}>
      <DialogTitle>{t('tallyCreate.title')}</DialogTitle>
      <DialogContent>
        { !hasUdpTally ? (
          <Alert className={classes.alert} severity="warning" variant="outlined" data-testid="tally-create-warning">
            {t('tallyCreate.warning')}
          </Alert>
        ) : "" }
        <Typography paragraph>{t('tallyCreate.description')}</Typography>

        <div className={classes.formWrapper}>
          <TextField
            className={classes.mb}
            data-testid="tally-create-name"
            label={t('tallyCreate.name')} 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            autoFocus={true}
          />
          <ChannelSelector value={channelIds} channels={channels} onChange={setChannelIds} />
        </div>
        
        <DialogActions>
          <Button onClick={onClose} color="default" data-testid="tally-create-cancel">{t('common.cancel')}</Button>
          <Tooltip title={errorMessage}><div>
            <Button disabled={!!errorMessage} color="primary" variant="contained" data-testid="tally-create-ok" onClick={handleCreate}>{t('tallyCreate.submit')}</Button>
          </div></Tooltip>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
}

function TallyCreate() {
  const classes = useStyles()
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)
  
  return (
    <Paper variant="outlined" className={classes.root}>
      <Button onClick={() => setModalOpen(true)} data-testid={`tally-create`}>{t('tallyCreate.title')}</Button>
      <TallyCreatePopup open={modalOpen} onClose={() => setModalOpen(false)} classes={classes} />
    </Paper>
  )
}

export default TallyCreate
