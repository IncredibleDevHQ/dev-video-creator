import React from 'react'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { ToastContainer } from 'react-toastify'
import { ErrorBoundary } from './components'
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
} from './modules'

const App = () => {
  return (
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
                <PrivateRoute exact path="/profile" component={Profile} />
                <PrivateRoute exact path="/new-flick" component={NewFlick} />
                <PrivateRoute
                  exact
                  path="/new-organisation"
                  component={NewOrganisation}
                />
                <PrivateRoute exact path="/flick/:id" component={Flick} />
                <PrivateRoute exact path="/flicks" component={Flicks} />
                <PrivateRoute
                  exact
                  path="/:fragmentId/studio"
                  component={Studio}
                />
                <PrivateRoute exact path="/profile/series" component={Series} />
                <PrivateRoute
                  exact
                  path="/series/:id"
                  component={SingleSeries}
                />
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
      </AuthorizedApolloProvider>
    </RecoilRoot>
  )
}

export default App
