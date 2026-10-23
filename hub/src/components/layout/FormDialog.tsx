import React from 'react'
import { makeStyles } from "tss-react/mui"
import { Button, Dialog, DialogActions, DialogContent, DialogProps, DialogTitle, IconButton, Typography, useMediaQuery, useTheme } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslation } from '../../i18n'

const useStyles = makeStyles()(theme => ({
  title: {
    borderBottom: "1px solid " + theme.palette.background.default,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingRight: theme.spacing(1),
  },
  content: {
    overflow: "hidden", // the bubble on the slider glitches sometimes
  },
  actions: {
    borderTop: "1px solid " + theme.palette.background.default,
    display: "flex",
    justifyContent: "space-between",
  },
  actionsLeft: {
  },
}))

type FormDialogProps = {
  "data-testid": string
  label: string
  onSubmit?: () => void
  onClose: () => void
  isLoading?: boolean
} & DialogProps

function FormDialog(props: FormDialogProps) {
  const {label, onSubmit, onClose, isLoading} = props
  const testId = props["data-testid"]
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const { classes } = useStyles()
  const { t } = useTranslation()

  return (
    <Dialog fullWidth={true} fullScreen={fullScreen} maxWidth="sm" scroll="body" {...props}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}>
        <DialogTitle className={classes.title}>
          <Typography variant="h1">{label}</Typography>
          <IconButton aria-label={t('dialog.close')} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent className={classes.content}>
          {props.children}
        </DialogContent>
        <DialogActions className={classes.actions}>
          <Button onClick={onClose} color="inherit" data-testid={`${testId}-close`}>{t('common.cancel')}</Button>
          <Button disabled={isLoading} color="primary" variant="contained" data-testid={`${testId}-submit`} type="submit">{t('common.save')}</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default FormDialog