import { Button, ButtonProps, alpha, lighten, } from '@mui/material'
import { makeStyles } from "tss-react/mui"
import React from 'react'

const useStyles = makeStyles()(theme => ({
  root: {
    padding: theme.spacing(0, 2),
    minWidth: 44,
    height: 44, // touch target (design system section 19)
    borderRadius: 22,
    textTransform: "none",
    fontWeight: "normal",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontSize: "0.8125rem",
  },
  contained: {
    color: theme.palette.common.white,
    backgroundColor: alpha(theme.palette.common.white, 0.25),
    "&:hover, &:focus, &:active": {
      backgroundColor: alpha(theme.palette.common.white, 0.4),
    }
  },
  colorPrimary: {
    color: theme.palette.getContrastText(theme.palette.primary.main),
    backgroundColor: theme.palette.primary.main,
    "&:hover, &:focus, &:active": {
      backgroundColor: lighten(theme.palette.primary.main, 0.25),
    },
    "&.Mui-disabled": {
      backgroundColor: alpha(theme.palette.primary.main, 0.4),
    },
  },
  colorSecondary: {
    color: theme.palette.getContrastText(theme.palette.secondary.main),
    backgroundColor: theme.palette.secondary.main,
    "&:hover, &:focus, &:active": {
      backgroundColor: lighten(theme.palette.secondary.main, 0.25),
    },
    "&.Mui-disabled": {
      backgroundColor: alpha(theme.palette.secondary.main, 0.4),
    },
  }
}))

type ChipLikeButtonProps = {
  selected: boolean
} & ButtonProps

// A button that looks like a [Chip](https://material-ui.com/components/chips/#chip)
function ChipLikeButton(props: ChipLikeButtonProps) {
  const { classes } = useStyles()

  return (<Button data-selected={props.selected} variant="contained" disableElevation={true} color={props.selected ? "primary" : "inherit" } classes={classes} {...props} />)
}

export default ChipLikeButton