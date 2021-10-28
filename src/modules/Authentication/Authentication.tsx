import { cx } from '@emotion/css'
import { useFormik } from 'formik'
import React, { useEffect, useState } from 'react'
import { FaGithub } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { Link, useHistory, useLocation } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import * as yup from 'yup'
import {
  Button,
  emitToast,
  Heading,
  ScreenState,
  Text,
  TextField,
} from '../../components'
import { ASSETS } from '../../constants'
import {
  useSendMagicSignInLinkLazyQuery,
  VerificationStatusEnum,
} from '../../generated/graphql'
import { Auth, authState } from '../../stores/auth.store'
import { userState, userVerificationStatus } from '../../stores/user.store'

const AuthenticateScreen = () => {
  const { signInWithGoogle, signInWithGithub, isAuthenticated } =
    (useRecoilValue(authState) as Auth) || {}

  const location = useLocation<{ from: string }>()
  const history = useHistory()
  const { from } = location.state || { from: { pathname: '/' } }

  const verificationStatus = useRecoilValue(userVerificationStatus)
  const [sentMagicLink, setSentMagicLink] = useState(false)

  const [SendMagicSignIn, { data, loading }] = useSendMagicSignInLinkLazyQuery({
    fetchPolicy: 'network-only',
  })

  useEffect(() => {
    if (data?.SendMagicLink?.success) {
      setSentMagicLink(true)
    }
  }, [data])

  const {
    errors,
    handleChange,
    handleSubmit,
    values,
    handleBlur,
    touched,
    isValid,
    setSubmitting,
  } = useFormik({
    initialValues: {
      email: '',
    },
    onSubmit: async (values) => {
      if (!isValid) return
      try {
        setSubmitting(true)

        await SendMagicSignIn({
          variables: {
            email: values.email,
          },
        })
      } catch (e: any) {
        emitToast({
          title: 'Something went wrong.',
          description: e.message,
          type: 'error',
        })
      } finally {
        setSubmitting(false)
      }
    },
    validationSchema: yup.object({
      email: yup
        .string()
        .email("Hmm...that doesn't look like an email address. Try again.")
        .required('Please provide your email.'),
    }),
  })

  useEffect(() => {
    if (!verificationStatus || !isAuthenticated) return

    if (verificationStatus.status === VerificationStatusEnum.Approved) {
      history.replace(from)
    }
  }, [isAuthenticated, verificationStatus])

  if (
    isAuthenticated === undefined ||
    verificationStatus === undefined ||
    verificationStatus?.loading
  )
    return <ScreenState title="Logging you in" loading />

  if (sentMagicLink) {
    return <MagicLinkState />
  }

  if (verificationStatus?.status === VerificationStatusEnum.InWaitlist) {
    return <WaitlistState isInWailist />
  }

  if (verificationStatus?.status === VerificationStatusEnum.NotInWaitlist) {
    return <WaitlistState isInWailist={false} />
  }

  return (
    <div className="grid grid-cols-2 h-screen">
      <div className="bg-gray-800 relative">
        <img
          src={ASSETS.ICONS.IncredibleLogoDark}
          alt="Incredible"
          className="m-4"
        />
        <div className="h-full w-full grid grid-cols-8 -mt-20">
          <Heading className="flex flex-col text-5xl col-start-2 col-end-8 text-white font-black self-end">
            <span>Create developer</span>
            <span>videos in record time</span>
          </Heading>
          <Text className="flex flex-col text-white mt-6 col-start-2 col-end-8 self-start">
            <span>
              Video creation made more effortless than eating a sandwich.
            </span>
            <span>Record. Share. Eat a sandwich.</span>
          </Text>
        </div>
        <img
          src={ASSETS.PATTERNS.LoginPattern}
          alt="Incredible"
          className="absolute right-0 bottom-0"
        />
      </div>
      <div>
        <div className="grid grid-cols-9 h-screen items-center">
          <div className="col-span-4 col-start-3 col-end-8">
            <Text className="font-bold text-2xl">Continue to Incredible</Text>
            <form className="w-full mt-8">
              <Text className="font-bold">Email</Text>
              <TextField
                label=""
                type="email"
                name="email"
                placeholder="Email"
                className="mb-2"
                onBlur={handleBlur}
                value={values.email}
                onChange={(e) => {
                  handleChange(e)
                }}
                caption={
                  touched.email && errors.email ? errors.email : undefined
                }
              />

              <Button
                type="button"
                className="w-full py-2.5 mt-4"
                appearance="primary"
                size="small"
                disabled={!isValid}
                onClick={(e) => {
                  e?.preventDefault()
                  handleSubmit()
                }}
                loading={loading}
              >
                Continue
              </Button>
            </form>

            <div className="h-px my-8 bg-gray-300" />
            <button
              type="button"
              className={cx(
                'font-semibold group border transition-all flex justify-center items-center rounded-md cursor-pointer w-full py-3 border-gray-300'
              )}
              onClick={() => {
                signInWithGoogle?.()
              }}
            >
              <FcGoogle className="mr-2" size={21} />
              Continue with Gmail
            </button>
            <button
              type="button"
              className={cx(
                'font-semibold group border transition-all flex justify-center items-center rounded-md cursor-pointer w-full py-3 border-gray-300 mt-4'
              )}
              onClick={() => {
                signInWithGithub?.()
              }}
            >
              <FaGithub className="mr-2" size={21} />
              Continue with Github
            </button>
            <div className="flex mt-12">
              <Text className="text-sm mr-3">Dont have access yet?</Text>
              <Link
                to="/waitlist"
                className="text-sm font-semibold mt-px hover:underline"
              >
                Join the waitlist
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const MagicLinkState = () => {
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
          <div className="h-24 w-24 bg-white border-8 border-brand rounded-full z-0" />
          <div className="h-32 w-32 rounded-full backdrop-filter backdrop-blur-xl -ml-10 z-20" />
          <div className="h-32 w-32 bg-gray-200 rounded-full -ml-32 z-10" />
        </div>
        <div className="px-14">
          <Text className="mt-8 font-black text-3xl flex flex-col mb-4">
            Check your mail for a magic link
          </Text>
          <Text>
            We’ve sent a magic link to amberjoe@gmail.com. The link will expire
            shortly, so please use it soon to continue.
          </Text>
          <Text className="text-sm mt-8">
            Can’t find your link? Check your spam folder.
          </Text>
        </div>
      </div>
    </div>
  )
}

const WaitlistState = ({ isInWailist }: { isInWailist: boolean }) => {
  const { signOut } = (useRecoilValue(authState) as Auth) || {}
  const user = useRecoilValue(userState)
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
              onClick={() => signOut?.()}
              className="text-sm font-semibold mt-px hover:underline cursor-pointer"
            >
              Log out
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthenticateScreen
