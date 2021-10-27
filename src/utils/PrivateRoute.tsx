import React, { useEffect } from 'react'
import { Route, Redirect, RouteProps, useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { ScreenState } from '../components'
import { VerificationStatusEnum } from '../generated/graphql'
import { Onboarding } from '../modules'
import { authState } from '../stores/auth.store'
import { userState, userVerificationStatus } from '../stores/user.store'

interface PrivateRouteProps extends RouteProps {
  component: any
  redirectTo?: string
}

const PrivateRoute = ({
  component: Component,
  redirectTo = '/login',
  ...rest
}: PrivateRouteProps): JSX.Element | null => {
  const { push } = useHistory()

  const auth = useRecoilValue(authState)
  const user = useRecoilValue(userState)
  const verificationStatus = useRecoilValue(userVerificationStatus)

  useEffect(() => {
    if (auth?.isAuthenticated === false && auth?.loading === false)
      push(redirectTo, { from: rest.location })
  }, [auth])

  useEffect(() => {
    if (verificationStatus === undefined) return
    if (verificationStatus?.status !== VerificationStatusEnum.Approved) {
      push('/login')
    }
  }, [verificationStatus])

  if (
    auth?.loading === true ||
    typeof auth?.loading === 'undefined' ||
    verificationStatus === undefined
  )
    return <ScreenState title="Just a jiffy" loading />

  if (!user?.onboarded) return <Onboarding />

  if (
    auth.isAuthenticated &&
    verificationStatus?.status === VerificationStatusEnum.Approved
  ) {
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
