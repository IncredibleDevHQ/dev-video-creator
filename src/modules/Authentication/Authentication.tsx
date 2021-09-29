import React, { useEffect, useState } from 'react'
import { FaGithub, FaGoogle } from 'react-icons/fa'
import { FiArrowRight } from 'react-icons/fi'
import { useRecoilValue } from 'recoil'
import { Link, useHistory, useLocation } from 'react-router-dom'
import { useFormik } from 'formik'
import * as yup from 'yup'
import { Auth, authState } from '../../stores/auth.store'
import { Button, emitToast, Logo, TextField } from '../../components'
import { useSendMagicSignInLinkLazyQuery } from '../../generated/graphql'

const AuthenticateScreen = () => {
  const { signInWithGoogle, signInWithGithub, isAuthenticated } =
    (useRecoilValue(authState) as Auth) || {}

  const location = useLocation<{ from: string }>()
  const history = useHistory()
  const { from } = location.state || { from: { pathname: '/' } }

  const [SendMagicSignIn, { data, loading, error }] =
    useSendMagicSignInLinkLazyQuery({
      fetchPolicy: 'network-only',
    })

  useEffect(() => {
    if (data?.SendMagicLink?.success) {
      emitToast({
        title: 'Link Sent Succesfully!',
        description: 'Please check your Email!',
        type: 'success',
      })
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
    if (isAuthenticated) {
      history.replace(from)
    }
  }, [isAuthenticated])

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-2/3 sm:w-1/3 lg:w-1/4 bg-gray-100 p-4 rounded-md flex flex-col items-center">
        <Logo size="large" className="mb-4" />
        <Button
          appearance="primary"
          className="w-full mb-4"
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
            name="email"
            className="mb-2"
            onBlur={handleBlur}
            value={values.email}
            onChange={(e) => {
              handleChange(e)
            }}
            caption={touched.email && errors.email ? errors.email : undefined}
            required
          />

          <div className="flex items-center flex-col justify-end">
            <Button
              type="button"
              className="my-2"
              appearance="primary"
              size="small"
              icon={FiArrowRight}
              iconPosition="right"
              disabled={!isValid}
              onClick={(e) => {
                e?.preventDefault()
                handleSubmit()
              }}
              loading={loading}
            >
              Sign in with Email
            </Button>
          </div>
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
