import React, { useEffect, useState } from 'react'
import { RecoilRoot } from 'recoil'
import Cohere from 'cohere-js'
import { ToastContainer } from 'react-toastify'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import { ScreenState } from './components'
import {
  Dashboard,
  Flick,
  GitHubCallback,
  Integrations,
  Landing,
  Notifications,
  Studio,
} from './modules'
import AuthProvider from './utils/auth'
import AuthorizedApolloProvider from './utils/AuthorizedApolloProvider'
import 'react-toastify/dist/ReactToastify.css'
import 'react-responsive-modal/styles.css'
import config from './config'

function detectBrowser() {
  if (
    (navigator.userAgent.indexOf('Opera') ||
      navigator.userAgent.indexOf('OPR')) !== -1
  )
    return 'Opera'
  if (navigator.userAgent.indexOf('Chrome') !== -1) return 'Chrome'
  if (navigator.userAgent.indexOf('Safari') !== -1) return 'Safari'
  if (navigator.userAgent.indexOf('Firefox') !== -1) return 'Firefox'
  if (
    navigator.userAgent.indexOf('MSIE') !== -1 ||
    // @ts-ignore
    !!document.documentMode === true
  )
    return 'IE'
  return 'Unknown'
}

const App = () => {
  const { apiKey } = config.cohere

  const [agentAllowed, setAgentAllowed] = useState(true)
  useEffect(() => {
    if (apiKey) Cohere.init(apiKey)
    if (detectBrowser() !== 'Chrome') {
      setAgentAllowed(false)
    }
  }, [])

  return agentAllowed ? (
    <RecoilRoot>
      <AuthorizedApolloProvider>
        <AuthProvider>
          <>
            <ToastContainer
              position="bottom-right"
              autoClose={5000}
              newestOnTop
              hideProgressBar
              closeOnClick
              draggable={false}
              toastClassName="rounded-2xl shadow-lg"
              closeButton={false}
            />
            <Router>
              <Switch>
                <Route exact path="/">
                  <Landing />
                </Route>
                <Route exact path="/dashboard">
                  <Dashboard />
                </Route>
                <Route exact path="/notifications">
                  <Notifications />
                </Route>
                <Route exact path="/story/:id/:fragmentId?">
                  <Flick />
                </Route>
                <Route exact path="/:fragmentId/studio">
                  <Studio />
                </Route>
                <Route exact path="/integrations/github/callback">
                  <GitHubCallback />
                </Route>
                <Route exact path="/integrations">
                  <Integrations />
                </Route>
              </Switch>
            </Router>
          </>
        </AuthProvider>
      </AuthorizedApolloProvider>
    </RecoilRoot>
  ) : (
    <ScreenState
      title="Regret the interruption"
      subtitle="Use Chrome to access this preview of Incredible."
    />
  )
}

export default App
