import React from 'react'
import { RecoilRoot } from 'recoil'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import AuthProvider from './utils/auth'
import AuthorizedApolloProvider from './utils/AuthorizedApolloProvider'
import { PrivateRoute } from './utils/PrivateRoute'
import { Login } from './components'
import { Home } from './modules'

const App = () => {
  return (
    <RecoilRoot>
      <AuthProvider>
        <AuthorizedApolloProvider>
          <Router>
            <Switch>
              <PrivateRoute exact path="/home" component={Home} />
              <Route exact path="/login">
                <Login />
              </Route>
            </Switch>
          </Router>
        </AuthorizedApolloProvider>
      </AuthProvider>
    </RecoilRoot>
  )
}

export default App
