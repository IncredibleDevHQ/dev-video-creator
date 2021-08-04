import React from 'react'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { ToastContainer } from 'react-toastify'
import { ErrorBoundary } from './components'
import AuthorizedApolloProvider from './utils/AuthorizedApolloProvider'
import AuthProvider from './utils/auth'
import PrivateRoute from './utils/PrivateRoute'
import {
  AuthenticateScreen,
  Dashboard,
  Flick,
  Flicks,
  Landing,
  NewFlick,
  Profile,
} from './modules'

const App = () => {
  return (
    <ErrorBoundary>
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
                  <PrivateRoute exact path="/profile" component={Profile} />
                  <PrivateRoute exact path="/new-flick" component={NewFlick} />
                  <PrivateRoute exact path="/flick/:id" component={Flick} />
                  <PrivateRoute exact path="/flicks" component={Flicks} />
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
    </ErrorBoundary>
  )
}

export default App
