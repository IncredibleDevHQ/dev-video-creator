import React, { useEffect } from 'react'
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { useRecoilValue } from 'recoil'
import { useHistory } from 'react-router-dom'
import firebaseState from '../../stores/firebase.store'
import { ScreenState } from '../../components'
import {
  useFetchEmailUsingStateQuery,
  VerificationStatusEnum,
} from '../../generated/graphql'
import { useQuery } from '../../hooks'
import { userVerificationStatus } from '../../stores/user.store'

const MagicLinkLogin = () => {
  const history = useHistory()
  const query = useQuery()

  const { auth } = useRecoilValue(firebaseState)
  const verificationStatus = useRecoilValue(userVerificationStatus)

  async function handleSignIn(email: string) {
    try {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        await signInWithEmailLink(auth, email, window.location.href)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    }
  }

  useEffect(() => {
    if (verificationStatus === VerificationStatusEnum.Approved) {
      history.push('/dashboard')
    } else {
      history.push('/')
    }
  }, [verificationStatus])

  const state = query.get('state') as string

  const { data, loading, error } = useFetchEmailUsingStateQuery({
    variables: {
      state,
    },
  })

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  if (!data?.FetchEmailUsingState?.email) {
    return (
      <ScreenState
        title="Invalid State!!"
        subtitle="Either the state is invalid or already used"
      />
    )
  }
  handleSignIn(data?.FetchEmailUsingState?.email)
  return null
}

export default MagicLinkLogin
