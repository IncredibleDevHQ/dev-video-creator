import React from 'react'
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { useRecoilValue } from 'recoil'
import { useHistory } from 'react-router-dom'
import firebaseState from '../../stores/firebase.store'
import { ScreenState } from '../../components'
import { useFetchEmailUsingStateQuery } from '../../generated/graphql'
import { useQuery } from '../../hooks'

const MagicLinkLogin = () => {
  const history = useHistory()
  const query = useQuery()

  const { auth } = useRecoilValue(firebaseState)

  if (auth.currentUser) history.push('/dashboard')

  async function handleSignIn(email: string) {
    try {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        const data = await signInWithEmailLink(
          auth,
          email,
          window.location.href
        )

        history.push(`/dashboard`)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    }
  }

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
