import React from 'react'
import MyTheme from './components/layout/MyTheme'
import { CssBaseline } from '@mui/material'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
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
        <Routes>
          <Route path="/tally/:tallyId" element={<WebTallyPage />} />
          <Route path="/tally/:tallyId/log" element={<TallyLogPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/control" element={<ControlPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/flasher" element={<FlasherPage />} />
          <Route path="*" element={<IndexPage />} />
        </Routes>
      </MyTheme>
    </Router>
    </I18nProvider>
  )
}

export default App;
