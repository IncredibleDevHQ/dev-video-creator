import React, { useEffect, useState } from 'react'
import { FaGithub, FaGoogle } from 'react-icons/fa'
import { FiArrowRight } from 'react-icons/fi'
import { useRecoilValue } from 'recoil'
import { Link, useHistory, useLocation } from 'react-router-dom'
import * as yup from 'yup'
import { Auth, authState } from '../stores/auth.store'
import { Button, emitToast, Logo, TextField } from '../components'

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
        .email("Hmm...that doesn't look like an email address. Try again.")
        .required('Please provide your email.')
        .validate(credential)
    case 'password':
      return yup
        .string()
        .required('Please key-in your password.')
        .min(8, 'Erm, you need 8 or more characters! You can do it!')
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
  const location = useLocation<{ from: string }>()
  const history = useHistory()
  const { from } = location.state || { from: { pathname: '/' } }

  useEffect(() => {
    setAuthenticationType(location.pathname === '/login' ? 'login' : 'signup')
  }, [location])

  useEffect(() => {
    if (isAuthenticated) {
      history.replace(from)
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
      history.push('/dashboard')
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
      history.push('/dashboard')
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
      <div className="w-2/3 sm:w-1/3 lg:w-1/4 bg-gray-100 p-4 rounded-md flex flex-col items-center">
        <Logo size="large" className="mb-4" />
        <Button
          appearance="primary"
          className="w-full mb-2"
          type="button"
          icon={FaGoogle}
          size="small"
          onClick={() => {
            signInWithGoogle?.()
          }}
        >
          Sign in with Google
        </Button>
        <Button
          appearance="primary"
          className="w-full"
          type="button"
          icon={FaGithub}
          size="small"
          onClick={() => {
            signInWithGithub?.()
          }}
        >
          Sign in with GitHub
        </Button>

        <span className="w-full mt-8 mb-4 border-t relative border-gray-700 border-dashed block h-px">
          <span className="uppercase text-sm absolute left-1/2 top-0 -translate-y-1/2 px-2 bg-gray-100 transform -translate-x-1/2">
            Or
          </span>
        </span>

        <form className="w-full">
          <TextField
            label="Email"
            type="email"
            className="mb-2"
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
          <div className="flex items-center justify-end">
            <Button
              type="submit"
              className="my-2"
              appearance="primary"
              size="small"
              icon={FiArrowRight}
              iconPosition="right"
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
          </div>
          {authenticationType === 'login' ? (
            <small className="font-semibold">
              New user?{' '}
              <Link to="/signup" className="text-blue-800">
                Sign Up
              </Link>
            </small>
          ) : (
            <small className="font-semibold">
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
