import React from 'react'
import MyTheme from './components/layout/MyTheme'
import { CssBaseline } from '@material-ui/core'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import IndexPage from './pages/IndexPage'
import ConfigPage from './pages/ConfigPage'
import TallyLogPage from './pages/TallyLogPage'
import WebTallyPage from './pages/WebTallyPage'
import FlasherPage from './pages/FlasherPage'
import ControlPage from './pages/ControlPage'
import AboutPage from './pages/AboutPage'
import { I18nProvider } from './i18n'

function App() {
  return (
    <I18nProvider>
    <Router>
      <MyTheme>
        <CssBaseline />
        <Switch>
          <Route exact path="/tally/:tallyId">
            <WebTallyPage />
          </Route>
          <Route exact path="/tally/:tallyId/log">
            <TallyLogPage />
          </Route>
          <Route exact path="/config">
            <ConfigPage />
          </Route>
          <Route exact path="/control">
            <ControlPage />
          </Route>
          <Route exact path="/about">
            <AboutPage />
          </Route>
          <Route exact path="/flasher">
            <FlasherPage />
          </Route>
          <Route path="/">
            <IndexPage />
          </Route>
        </Switch>
      </MyTheme>
    </Router>
    </I18nProvider>
  )
}

export default App;
