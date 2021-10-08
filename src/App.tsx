import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { ToastContainer } from 'react-toastify'
import AuthorizedApolloProvider from './utils/AuthorizedApolloProvider'
import AuthProvider from './utils/auth'
import PrivateRoute from './utils/PrivateRoute'
import 'react-toastify/dist/ReactToastify.css'
import 'react-responsive-modal/styles.css'

import {
  AuthenticateScreen,
  Dashboard,
  Flick,
  Flicks,
  Landing,
  NewFlick,
  NewOrganisation,
  Organisation,
  Profile,
  Series,
  AllUserFlicks,
  Studio,
  UserSeriesFlicks,
  SingleSeries,
  Circle,
  Designer,
  NewFragment,
  PublicOrganisationPage,
  InviteScreen,
  PublicVideo,
  MagicLinkLogin,
  NewNewFragment,
  FlickNew,
} from './modules'
import { ErrorBoundary, ScreenState } from './components'

function detectBrowser() {
  if (
    (navigator.userAgent.indexOf('Opera') ||
      navigator.userAgent.indexOf('OPR')) != -1
  ) {
    return 'Opera'
  } else if (navigator.userAgent.indexOf('Chrome') != -1) {
    return 'Chrome'
  } else if (navigator.userAgent.indexOf('Safari') != -1) {
    return 'Safari'
  } else if (navigator.userAgent.indexOf('Firefox') != -1) {
    return 'Firefox'
  } else if (
    navigator.userAgent.indexOf('MSIE') != -1 ||
    // @ts-ignore
    !!document.documentMode == true
  ) {
    return 'IE' // crap
  } else {
    return 'Unknown'
  }
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
                <Route exact path="/">
                  <Landing />
                </Route>
                <PrivateRoute exact path="/dashboard" component={Dashboard} />
                <PrivateRoute
                  exact
                  path="/organisations"
                  component={Organisation}
                />
                <PrivateRoute exact path="/new-flick" component={NewFlick} />
                {/* Commenting out Profiles route... */}
                {/* <PrivateRoute exact path="/profile" component={Profile} /> */}
                <PrivateRoute
                  exact
                  path="/new-flick/:seriesId?"
                  component={NewFlick}
                />
                <PrivateRoute
                  exact
                  path="/new-organisation"
                  component={NewOrganisation}
                />
                <PrivateRoute exact path="/designer" component={Designer} />
                <PrivateRoute
                  exact
                  path="/flick/:id/:fragmentId?"
                  component={FlickNew}
                />
                <PrivateRoute
                  exact
                  path="/new-fragment/:id"
                  component={NewNewFragment}
                />
                <PrivateRoute exact path="/flicks" component={Flicks} />
                <PrivateRoute
                  exact
                  path="/:fragmentId/studio"
                  component={Studio}
                />

                <PrivateRoute exact path="/profile/series" component={Series} />
                <PrivateRoute
                  exact
                  path="/profile/flicks"
                  component={AllUserFlicks}
                />
                <PrivateRoute
                  exact
                  path="/profile/series/:id"
                  component={UserSeriesFlicks}
                />
                <PrivateRoute exact path="/circle" component={Circle} />
                <Route exact path="/view/:joinLink">
                  <PublicVideo />
                </Route>
                <Route exact path="/series/:id">
                  <SingleSeries />
                </Route>
                <Route exact path="/login">
                  <AuthenticateScreen />
                </Route>
                <Route exact path="/signup">
                  <AuthenticateScreen />
                </Route>
              </Switch>
            </Router>
          </>
        </AuthProvider>

        <Router forceRefresh>
          {/* history.push wasn't working in InviteScreen, therefore added forceRefresh */}
          <Switch>
            <Route exact path="/organisations/:organisationSlug">
              <PublicOrganisationPage />
            </Route>
            <Route exact path="/invite/:flickId">
              <InviteScreen />
            </Route>
            <Route exact path="/magiclink">
              <MagicLinkLogin />
            </Route>
          </Switch>
        </Router>
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
