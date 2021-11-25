import React, { useEffect } from 'react'
import { Route, Redirect, RouteProps, useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { ScreenState } from '../components'
import { VerificationStatusEnum } from '../generated/graphql'
import { Onboarding } from '../modules'
import firebaseState from '../stores/firebase.store'
import { userState, userVerificationStatus } from '../stores/user.store'

interface PrivateRouteProps extends RouteProps {
  component: any
  redirectTo?: string
}

const PrivateRoute = ({
  component: Component,
  redirectTo = '/',
  ...rest
}: PrivateRouteProps): JSX.Element | null => {
  const { push } = useHistory()

  const user = useRecoilValue(userState)
  const auth = useRecoilValue(firebaseState)
  const verificationStatus = useRecoilValue(userVerificationStatus)

  useEffect(() => {
    if (!verificationStatus) return
    if (verificationStatus !== VerificationStatusEnum.Approved) push('/')
  }, [verificationStatus])

  if (
    auth?.loading === true ||
    typeof auth?.loading === 'undefined' ||
    verificationStatus === undefined
  )
    return <ScreenState title="Just a jiffy" loading />

  if (!user?.onboarded) return <Onboarding />

  if (user && verificationStatus === VerificationStatusEnum.Approved) {
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
  redirectTo: '/',
}

export default PrivateRoute
