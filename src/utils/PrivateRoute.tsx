import React from 'react'
import { Redirect, Route, RouteProps } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { ScreenState } from '../components'
import firebaseState from '../stores/firebase.store'
import { userState } from '../stores/user.store'

interface PrivateRouteProps extends RouteProps {
  component: any
  redirectTo?: string
}

const PrivateRoute = ({
  component: Component,
  redirectTo = '/',
  ...rest
}: PrivateRouteProps): JSX.Element | null => {
  const user = useRecoilValue(userState)
  const { loading } = useRecoilValue(firebaseState)

  if (loading === true || typeof loading === 'undefined' || !user?.uid)
    return <ScreenState title="Just a jiffy" loading />

  if (user.sub) {
    return (
      <Route {...rest} render={(routeProps) => <Component {...routeProps} />} />
    )
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
