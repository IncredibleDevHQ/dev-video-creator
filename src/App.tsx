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
  Presentation,
  Studio,
} from './modules'
import AuthProvider from './utils/auth'
import AuthorizedApolloProvider from './utils/AuthorizedApolloProvider'
import 'react-toastify/dist/ReactToastify.css'
import 'react-responsive-modal/styles.css'
import config from './config'
import { ReactComponent as NotFound } from './assets/404.svg'

const FourOhFour = () => {
  return (
    <div className="flex flex-row items-center justify-center h-screen px-2 md:px-0 bg-dark-500">
      <div className="flex flex-col space-y-16">
        <NotFound className="h-full w-full" />
        <div className="text-center">
          <p className="mb-2 text-3xl font-bold text-white font-main">
            Uh-oh, page not found
          </p>
          <p className="mb-6 text-base text-gray-300 font-normal text-incredible-dark-200 font-body">
            Sorry, this page doesn’t exist or it was removed
          </p>
          <button
            type="button"
            className="px-5 py-3 text-base font-semibold text-white rounded cursor-pointer font-main bg-incredible-green-600 w-full"
            onClick={() => {
              window.location.href = '/'
            }}
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  )
}

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
          <Route exact path="/present/:fragmentId">
            <Presentation />
          </Route>
          <AuthorizedApolloProvider>
            <AuthProvider>
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
                  <Route>
                    <FourOhFour />
                  </Route>
                </Switch>
              </Router>
            </AuthProvider>
          </AuthorizedApolloProvider>
        </Switch>
      </Router>
    </RecoilRoot>
  ) : (
    <ScreenState
      title="Regret the interruption"
      subtitle="Use Chrome to access this preview of Incredible."
    />
  )
}

export default App
