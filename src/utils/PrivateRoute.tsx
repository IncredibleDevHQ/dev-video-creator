import React from 'react'
import { Route, Redirect, RouteProps, useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { ScreenState } from '../components'
import { Onboarding } from '../modules'
import { authState } from '../stores/auth.store'
import { userState } from '../stores/user.store'

interface PrivateRouteProps extends RouteProps {
  component: any
  redirectTo?: string
}

const PrivateRoute = ({
  component: Component,
  redirectTo,
  ...rest
}: PrivateRouteProps): JSX.Element | null => {
  const auth = useRecoilValue(authState)
  const user = useRecoilValue(userState)

  if (auth?.loading === true || typeof auth?.loading === 'undefined')
    return <ScreenState title="Just a jiffy" loading />

  if (!user?.onboarded) return <Onboarding />

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

PrivateRoute.defaultProps = {
  redirectTo: '/login',
}

export default PrivateRoute
