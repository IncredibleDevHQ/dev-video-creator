import React from 'react'
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { useRecoilValue } from 'recoil'
import { useHistory } from 'react-router-dom'
import firebaseState from '../../stores/firebase.store'
import { ScreenState } from '../../components'
import { useGetGuestUserQuery } from '../../generated/graphql'
import { useQueryVariables } from '../../hooks'

const MagicLinkLogin = () => {
  const history = useHistory()
  const query = useQueryVariables()

  const { auth } = useRecoilValue(firebaseState)

  if (auth.currentUser) history.push('/dashboard')

  async function handleSignIn(email: string) {
    if (!email) return

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

  const { data, loading, error } = useGetGuestUserQuery({
    variables: {
      state,
    },
  })

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (data) {
    if (data.User.length === 0)
      return (
        <ScreenState
          title="Invalid State!!"
          subtitle="Either the state is invalid or already used"
        />
      )

    handleSignIn(data?.User[0].email as string)
  }

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return <ScreenState title="Just a jiffy" loading />
}

export default MagicLinkLogin
