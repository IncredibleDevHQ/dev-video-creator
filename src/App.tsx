import React, { useEffect, useState } from 'react'
import 'react-responsive-modal/styles.css'
import { BrowserRouter as Router, Switch } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { RecoilRoot } from 'recoil'
import { ScreenState } from './components'
import { Flick, GitHubCallback, Integrations, Studio } from './modules'
import AuthProvider from './utils/auth'
import AuthorizedApolloProvider from './utils/AuthorizedApolloProvider'
import PrivateRoute from './utils/PrivateRoute'

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
  const [agentAllowed, setAgentAllowed] = useState(true)
  useEffect(() => {
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
