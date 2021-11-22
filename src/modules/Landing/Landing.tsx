import { cx } from '@emotion/css'
import axios from 'axios'
import React, { useEffect } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { Link, useHistory, useLocation } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { ScreenState, Text, Button, emitToast } from '../../components'
import config from '../../config'
import { ASSETS } from '../../constants'
import { VerificationStatusEnum } from '../../generated/graphql'
import firebaseState from '../../stores/firebase.store'
import { userVerificationStatus } from '../../stores/user.store'

const Landing = () => {
  const verificationStatus = useRecoilValue(userVerificationStatus)
  const fbState = useRecoilValue(firebaseState)
  const [, loading] = useAuthState(fbState.auth)
  const location = useLocation<{ from: string }>()
  const { from } = location.state || { from: { pathname: '/' } }

  const history = useHistory()

  useEffect(() => {
    if (!verificationStatus) return
    if (verificationStatus === VerificationStatusEnum.Approved) {
      console.log('from', from)
      // history.replace(from)
      history.push('/dashboard')
    }
  }, [verificationStatus])

  if (fbState.loading || loading)
    return <ScreenState title="Just a jiffy" loading />

  if (verificationStatus === VerificationStatusEnum.InWaitlist) {
    return <WaitlistState isInWailist />
  }

  if (verificationStatus === VerificationStatusEnum.NotInWaitlist) {
    return <WaitlistState isInWailist={false} />
  }

  return null
}

const WaitlistState = ({ isInWailist }: { isInWailist: boolean }) => {
  const fbState = useRecoilValue(firebaseState)
  const [user] = useAuthState(fbState.auth)

  const handleSignOut = async () => {
    try {
      await fbState.auth.signOut()
      await axios.post(`${config.auth.endpoint}/logout`)
      window.location.href = config.auth.endpoint
    } catch (error) {
      emitToast({
        type: 'error',
        title: 'Error signing out',
      })
    }
  }

  return (
    <div className="w-screen min-h-screen grid grid-cols-12">
      <img
        src={ASSETS.ICONS.IncredibleLogo}
        alt="Incredible"
        className="absolute left-0 top-0 m-4"
      />
      <div
        className={cx(
          'w-full col-start-5 col-end-9 flex flex-col items-center justify-end -mt-12',
          {
            'justify-center': true,
          }
        )}
      >
        <div className="flex">
          <div className="h-24 w-24 bg-white border-8 border-gray-300 rounded-full z-0" />
          <div className="h-32 w-32 rounded-full backdrop-filter backdrop-blur-xl -ml-10 z-20" />
          <div className="h-32 w-32 bg-gray-200 rounded-full -ml-32 z-10" />
        </div>
        <div className="px-14">
          <Text className="mt-8 font-black text-3xl flex flex-col mb-4">
            <span>
              {isInWailist
                ? 'You are in the waitlist'
                : 'Uh-oh, you are not in the waitlist'}
            </span>
          </Text>
          <Text>
            {isInWailist
              ? 'We’re working hard to make Incredible available to everyone. We will get back to you as soon as possible. Hang in there!'
              : 'We’re working hard to make Incredible available to everyone. Join the waitlist and we will get back to you soon.'}
          </Text>
          {!isInWailist && (
            <Link to="/waitlist">
              <Button
                type="button"
                className="w-full py-2.5 mt-10"
                appearance="primary"
                size="small"
              >
                Join Waitlist
              </Button>
            </Link>
          )}
          <div className="flex flex-wrap mt-12">
            <Text className="text-sm mr-3">
              Signed in with {user?.email}. Not you?
            </Text>
            <Text
              onClick={() => handleSignOut()}
              className="text-sm font-semibold hover:underline cursor-pointer"
            >
              Log out
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Landing
