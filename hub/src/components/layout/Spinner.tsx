import { CircularProgress, } from '@mui/material'
import { makeStyles } from "tss-react/mui"
import React from 'react'

const useStyles = makeStyles()(() => ({
  root: {
    display: "block",
    margin: "0 auto",
  }
}))

function Spinner() {
  const { classes } = useStyles()
  return (
      <CircularProgress classes={{root: classes.root}} color="inherit" />
  )
}

export default Spinner
