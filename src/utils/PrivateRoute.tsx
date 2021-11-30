import React from 'react'
import { Route, RouteProps } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { ScreenState } from '../components'
import firebaseState from '../stores/firebase.store'
import { userVerificationStatus } from '../stores/user.store'

interface PrivateRouteProps extends RouteProps {
  component: any
  redirectTo?: string
}

const PrivateRoute = ({
  component: Component,
  ...rest
}: PrivateRouteProps): JSX.Element | null => {
  const auth = useRecoilValue(firebaseState)
  const verificationStatus = useRecoilValue(userVerificationStatus)

  if (
    auth?.loading === true ||
    typeof auth?.loading === 'undefined' ||
    verificationStatus === undefined
  )
    return <ScreenState title="Just a jiffy" loading />

  return (
    <Route {...rest} render={(routeProps) => <Component {...routeProps} />} />
  )
}

export default PrivateRoute
