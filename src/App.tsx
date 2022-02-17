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
  Studio,
} from './modules'
import AuthProvider from './utils/auth'
import PrivateRoute from './utils/PrivateRoute'
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
                <PrivateRoute exact path="/dashboard" component={Dashboard} />
                <PrivateRoute
                  exact
                  path="/flick/:id/:fragmentId?"
                  component={Flick}
                />
                <PrivateRoute
                  exact
                  path="/:fragmentId/studio"
                  component={Studio}
                />
                <PrivateRoute
                  exact
                  path="/integrations/github/callback"
                  component={GitHubCallback}
                />
                <PrivateRoute
                  exact
                  path="/integrations"
                  component={Integrations}
                />
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
