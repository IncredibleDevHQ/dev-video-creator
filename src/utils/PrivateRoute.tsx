import React from 'react'
import { Route, Redirect, RouteProps } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { ScreenState } from '../components'
import { authState } from '../stores/auth.store'
import { userState } from '../stores/user.store'

interface PrivateRouteProps extends RouteProps {
  // eslint-disable-next-line
  component: any
  // eslint-disable-next-line
  redirectTo?: string
}

const PrivateRoute = ({
  component: Component,
  redirectTo = '/login',
  ...rest
}: PrivateRouteProps): JSX.Element | null => {
  const auth = useRecoilValue(authState)
  const user = useRecoilValue(userState)

  if (auth?.loading === true || typeof auth?.loading === 'undefined')
    return <ScreenState />

  if (auth.isAuthenticated) {
    return user?.uid ? (
      <Route {...rest} render={(routeProps) => <Component {...routeProps} />} />
    ) : null
  }

  return (
    <Route
      {...rest}
      render={(routeProps) => (
        <Redirect
          to={{
            pathname: redirectTo,
            state: { from: routeProps.location },
          }}
        />
      )}
    />
  )
}
export default PrivateRoute
