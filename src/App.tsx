import React from 'react'
import { RecoilRoot } from 'recoil'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import AuthProvider from './utils/auth'
import AuthorizedApolloProvider from './utils/AuthorizedApolloProvider'
import PrivateRoute from './utils/PrivateRoute'
import {
  Home,
  AuthenticateScreen,
  Profile,
  Series,
  Flicks,
  UserSeriesFlicks,
} from './modules'
import { ErrorBoundary } from './components'

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
                  <PrivateRoute exact path="/home" component={Home} />
                  <PrivateRoute exact path="/profile" component={Profile} />
                  <PrivateRoute
                    exact
                    path="/profile/series"
                    component={Series}
                  />
                  <PrivateRoute
                    exact
                    path="/profile/flicks"
                    component={Flicks}
                  />
                  <PrivateRoute
                    exact
                    path="/profile/series/:id"
                    component={UserSeriesFlicks}
                  />
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
