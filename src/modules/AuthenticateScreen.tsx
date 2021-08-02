import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { Link, useHistory, useLocation } from 'react-router-dom'
import * as yup from 'yup'
import { Auth, authState } from '../stores/auth.store'
import { Button, emitToast, Logo, TextField } from '../components'
import { ASSETS } from '../constants'

type Authentication = 'login' | 'signup'

interface UserCredentials {
  email: string
  password: string
}

const initialState: UserCredentials = { email: '', password: '' }

const validateCredentials = async (
  field: keyof UserCredentials,
  credential: string
): Promise<string | null> => {
  switch (field) {
    case 'email':
      return yup
        .string()
        .email('Not a valid email')
        .required('No email provided')
        .validate(credential)
    case 'password':
      return yup
        .string()
        .required('No password provided.')
        .min(8, 'Password is too short - should be 8 chars minimum.')
        .matches(/[a-zA-Z]/, 'Password can only contain Latin letters.')
        .validate(credential)
    default:
      return null
  }
}

const AuthenticateScreen = () => {
  const {
    createUserWithEmail,
    signInWithGoogle,
    signInWithGithub,
    signInWithEmail,
    isAuthenticated,
  } = (useRecoilValue(authState) as Auth) || {}
  const [credentials, setCredentials] = useState<UserCredentials>(initialState)
  const [credentialErrors, setCredentialError] =
    useState<UserCredentials>(initialState)
  const [authenticationType, setAuthenticationType] =
    useState<Authentication>('signup')
  const location = useLocation()
  const history = useHistory()

  useEffect(() => {
    setAuthenticationType(location.pathname === '/login' ? 'login' : 'signup')
  }, [location])

  useEffect(() => {
    if (isAuthenticated) {
      history.push('/home')
    }
  }, [isAuthenticated])

  useEffect(() => {
    ;(async () => {
      try {
        await validateCredentials('email', credentials.email)
        await validateCredentials('password', credentials.password)
        setCredentialError(initialState)
      } catch (error: any) {
        setCredentialError({
          ...credentialErrors,
          [error.type ? 'email' : 'password']: error.message,
        })
      }
    })()
  }, [credentials])

  const signInUserWithEmail = async () => {
    try {
      await signInWithEmail?.(credentials?.email, credentials?.password)
      emitToast({
        title: 'Signed Up Successfully',
        type: 'success',
        description: 'We welcome you to Incredible.dev!!',
      })
      history.push('/home')
    } catch (error: any) {
      emitToast({
        title: "We couldn't sign you in",
        autoClose: false,
        type: 'error',
        description: `Click this toast to refresh and give it another try. (${error.code})`,
        onClick: () => window.location.reload(),
      })
    }
  }

  const signUpWithEmail = async () => {
    try {
      await createUserWithEmail?.(credentials?.email, credentials?.password)
      emitToast({
        title: 'Signed Up Successfully',
        type: 'success',
        description: 'We welcome you to Incredible.dev!!',
      })
      history.push('/home')
    } catch (error: any) {
      emitToast({
        title: "We couldn't sign you up",
        autoClose: false,
        type: 'error',
        description: `Click this toast to refresh and give it another try. (${error.code})`,
        onClick: () => window.location.reload(),
      })
    }
  }

  const handleCredentialChange = (
    field: keyof UserCredentials,
    value: string
  ) => {
    setCredentials({
      ...credentials,
      [field]: value,
    })
  }

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-2/3 sm:w-1/3 lg:w-1/4 bg-gray-50 p-4 rounded-md flex flex-col items-center">
        <Logo size="large" className="mb-4" />
        <Button
          buttonStyle="primary"
          className="w-full"
          type="button"
          icon={
            <img className="w-8 h-8" src={ASSETS.ICONS.GOOGLE} alt="google" />
          }
          onClick={() => {
            signInWithGoogle?.()
          }}
        >
          Sign in with Google
        </Button>
        <Button
          buttonStyle="primary"
          className="w-full"
          type="button"
          icon={
            <img className="w-8 h-8" src={ASSETS.ICONS.GITHUB} alt="google" />
          }
          onClick={() => {
            signInWithGithub?.()
          }}
        >
          Sign in with Github
        </Button>
        <form className="w-full">
          <TextField
            label="Email"
            type="email"
            className="my-2"
            value={credentials?.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              handleCredentialChange('email', e.target.value)
            }}
            caption={credentialErrors.email}
            required
          />
          <TextField
            label="Password"
            type="password"
            className="my-2"
            value={credentials?.password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              handleCredentialChange('password', e.target.value)
            }}
            caption={credentialErrors.password}
            required
          />
          <Button
            type="submit"
            className="my-2"
            buttonStyle="primary"
            onClick={(e) => {
              e?.preventDefault()
              if (authenticationType === 'login') {
                signInUserWithEmail()
              } else {
                signUpWithEmail()
              }
            }}
          >
            {authenticationType === 'login' ? 'Sign In' : 'Sign Up'}
          </Button>
          {authenticationType === 'login' ? (
            <small>
              New user?{' '}
              <Link to="/signup" className="text-blue-800">
                Sign Up
              </Link>
            </small>
          ) : (
            <small>
              Already a member?{' '}
              <Link to="/login" className="text-blue-800">
                Sign In
              </Link>
            </small>
          )}
        </form>
      </div>
    </div>
  )
}

export default AuthenticateScreen

/**
 * TODO:
 * 1. Debounce Input
 * 2. UI update with new branding
 */
