import React from 'react'
import { Button, ButtonGroup, makeStyles } from '@material-ui/core'
import { LANGUAGES, useTranslation } from '../../i18n'

const useStyles = makeStyles(() => ({
  button: {
    minWidth: 44,
    minHeight: 44,
    padding: 0,
  },
}))

const LanguageSwitch = () => {
  const classes = useStyles()
  const { t, language, setLanguage } = useTranslation()

  return (
    <ButtonGroup size="small" aria-label={t('language.label')} data-testid="language-switch">
      {LANGUAGES.map(code => (
        <Button
          key={code}
          className={classes.button}
          variant={language === code ? 'contained' : 'outlined'}
          color={language === code ? 'primary' : 'default'}
          aria-pressed={language === code}
          lang={code}
          data-testid={`language-${code}`}
          onClick={() => setLanguage(code)}
        >{code.toUpperCase()}</Button>
      ))}
    </ButtonGroup>
  )
}

export default LanguageSwitch
