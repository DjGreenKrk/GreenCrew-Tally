import React from 'react'
import { Box, Divider, List, ListItem, ListItemText, makeStyles, Paper, Typography } from '@material-ui/core'
import Layout from '../components/layout/Layout'
import ExternalLink from '../components/ExternalLink'
import { buildInfo } from '../buildInfo'
import { useTranslation } from '../i18n'
import LanguageSwitch from '../components/layout/LanguageSwitch'

const useStyles = makeStyles(theme => ({
  paper: {
    maxWidth: 640,
    margin: '0 auto',
    padding: theme.spacing(2),
    wordBreak: 'break-word',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  logo: {
    marginRight: theme.spacing(2),
    flexShrink: 0,
  },
  item: {
    minHeight: 44,
  },
  section: {
    marginTop: theme.spacing(2),
  },
}))

const noun = [
  { name: 'Eucalyp', href: 'https://thenounproject.com/browse/?i=3151803' },
  { name: 'Atif Arshad', href: 'https://thenounproject.com/browse/?i=1294543' },
  { name: 'priyanka', href: 'https://thenounproject.com/browse/?i=1637910' },
  { name: 'Hrbon', href: 'https://thenounproject.com/browse?i=3014911' },
  { name: 'ProSymbols', href: 'https://thenounproject.com/browse/?i=1086042' },
]

const AboutPage = () => {
  const classes = useStyles()
  const { t, language } = useTranslation()
  const buildDate = buildInfo.builtAt ? new Date(buildInfo.builtAt).toLocaleString(language) : t('common.developmentBuild')

  const rows: Array<[string, React.ReactNode]> = [
    [t('about.version'), buildInfo.version],
    [t('about.buildDate'), buildDate],
    [t('about.author'), 'Julian Szymański'],
    [t('about.organisation'), 'GreenCrew'],
    [t('about.website'), <ExternalLink href="https://greencrew.pl">https://greencrew.pl</ExternalLink>],
    [t('about.repository'), <ExternalLink href="https://github.com/DjGreenKrk/GreenCrew-Tally">https://github.com/DjGreenKrk/GreenCrew-Tally</ExternalLink>],
    [t('about.licence'), <ExternalLink href="https://github.com/DjGreenKrk/GreenCrew-Tally/blob/main/LICENSE">MIT</ExternalLink>],
    [t('about.copyright'), '© Julian Szymański / GreenCrew'],
  ]

  return (<Layout testId="about">
    <Paper className={classes.paper}>
      <div className={classes.header}>
        <img width="64" height="64" className={classes.logo} src="/favicon.svg" alt="" />
        <div>
          <Typography variant="h5" component="h1">GreenCrew Tally (GC Tally)</Typography>
          <Typography variant="body2" color="textSecondary">{t('about.description')}</Typography>
        </div>
      </div>
      <List disablePadding>
        {rows.map(([label, value]) => (
          <ListItem key={label} className={classes.item} disableGutters>
            <ListItemText primary={value} secondary={label} />
          </ListItem>
        ))}
      </List>
      <Typography variant="body2">{t('about.partOf')}</Typography>
      <Divider className={classes.section} />
      <Box className={classes.section}>
        <Typography variant="h6" component="h2">{t('language.title')}</Typography>
        <LanguageSwitch />
      </Box>
      <Divider className={classes.section} />
      <Box className={classes.section}>
        <Typography variant="h6" component="h2">{t('about.credits')}</Typography>
        <List disablePadding>
          <ListItem className={classes.item} disableGutters>
            <ListItemText
              primary={<ExternalLink href="https://github.com/wifi-tally/wifi-tally">vTally / wifi-tally</ExternalLink>}
              secondary={t('about.creditsOriginal')} />
          </ListItem>
          <ListItem className={classes.item} disableGutters>
            <ListItemText
              primary={<ExternalLink href="https://github.com/kuuminsh/wifi-tally">kuuminsh/wifi-tally</ExternalLink>}
              secondary="kuuminsh" />
          </ListItem>
          <ListItem className={classes.item} disableGutters>
            <ListItemText primary="GreenCrew Tally" secondary="GreenCrew" />
          </ListItem>
        </List>
        <Typography variant="subtitle2" className={classes.section}>{t('about.icons')}</Typography>
        <List disablePadding>
          {noun.map(n => (
            <ListItem key={n.name} className={classes.item} disableGutters>
              <ListItemText primary={<ExternalLink href={n.href}>{n.name}</ExternalLink>} />
            </ListItem>
          ))}
        </List>
        <Typography variant="body2">
          <ExternalLink href="https://creativecommons.org/licenses/by/3.0/us/legalcode">CC-BY-3.0</ExternalLink>
        </Typography>
      </Box>
    </Paper>
  </Layout>)
}

export default AboutPage
