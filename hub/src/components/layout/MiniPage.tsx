import { Container, Paper, Typography } from '@mui/material'
import { makeStyles } from "tss-react/mui"
import React from 'react'


const useStyles = makeStyles<{ contentPadding?: string }>()((theme, props) => {
  return {
    root: {
      marginBottom: theme.spacing(2),
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      padding: theme.spacing(1, 2),
      borderBottom: "1px solid " + theme.palette.divider,
    },
    content: {
      padding: theme.spacing(2, props.contentPadding || 2),
    }
  }
})

type MiniPageProps = {
  title?: string,
  addHeaderContent?: React.ReactNode
  contentPadding?: string
  testId?: string
  children: React.ReactNode
}

function MiniPage({ title, addHeaderContent, contentPadding, testId, children }: MiniPageProps) {
  const { classes } = useStyles({
    contentPadding
  })

  return(
    <Container className={classes.root} maxWidth="sm" data-testid={testId}>
      <Paper>
        <div className={classes.header}>
          <Typography variant="h4" component="h1">{title}</Typography>
          {addHeaderContent}
        </div>
        <div className={classes.content}>{children}</div>
      </Paper>
    </Container>
  )
}

export default MiniPage