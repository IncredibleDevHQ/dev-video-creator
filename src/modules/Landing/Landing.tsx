import React, { useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { Auth, authState } from '../../stores/auth.store'
import { ScreenState } from '../../components'
import { userVerificationStatus } from '../../stores/user.store'
import { VerificationStatusEnum } from '../../generated/graphql'

const Landing = () => {
  const { isAuthenticated } = (useRecoilValue(authState) as Auth) || {}
  const verificationStatus = useRecoilValue(userVerificationStatus)

  const history = useHistory()

  useEffect(() => {
    if (isAuthenticated === undefined) return
    if (isAuthenticated) {
      if (verificationStatus?.status === VerificationStatusEnum.Approved)
        history.push('/dashboard')
      else history.push('/login')
    } else {
      history.push('/login')
    }
  }, [isAuthenticated, verificationStatus])

  return <ScreenState title="Just a jiffy" loading />
}

export default Landing
