import React, { useEffect } from 'react'
import { Route, Redirect, RouteProps } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { ScreenState } from '../components'
import { Auth, authState } from '../stores/auth.store'
import { userState } from '../stores/user.store'

interface PrivateRouteProps extends RouteProps {
  // tslint:disable-next-line:no-any
  component: any
  redirectTo?: string
}
const PrivateRoute = ({
  component: Component,
  redirectTo = '/login',
  ...rest
}: PrivateRouteProps) => {
  const auth = useRecoilValue(authState)
  const user = useRecoilValue(userState)

  return (
    <Route
      {...rest}
      render={(routeProps) =>
        auth?.loading === true || typeof auth?.loading === 'undefined' ? (
          <ScreenState />
        ) : auth?.isAuthenticated ? (
          user?.uid ? (
            <Component {...routeProps} />
          ) : null
        ) : (
          <Redirect
            to={{
              pathname: redirectTo,
              state: { from: routeProps.location },
            }}
          />
        )
      }
    />
  )
}
export { PrivateRoute }
