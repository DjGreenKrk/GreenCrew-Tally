import { CircularProgress, } from '@mui/material'
import { makeStyles } from "tss-react/mui"
import React from 'react'

const useStyles = makeStyles()(() => ({
  root: {
    display: "block",
    margin: "0 auto",
  }
}))

type SpinnerProps = {
  label?: string
  testId?: string
}

function Spinner({ label, testId }: SpinnerProps) {
  const { classes } = useStyles()
  return (
      <CircularProgress classes={{root: classes.root}} color="inherit" aria-label={label} data-testid={testId} />
  )
}

export default Spinner
