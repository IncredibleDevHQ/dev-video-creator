import { cx } from '@emotion/css'
import { useFormik } from 'formik'
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import * as yup from 'yup'
import { Button, emitToast, Text, TextField } from '../../components'
import { ASSETS } from '../../constants'
import { useAddEmailToWaitlistMutation } from '../../generated/graphql'
import gmail from '../../assets/gmail.svg'
import outlook from '../../assets/outlook.svg'

const JoinWaitlist = () => {
  const [showQueue, setShowQueue] = useState(false)

  const [addEmailToWaitlist, { data, error }] = useAddEmailToWaitlistMutation()

  const {
    errors,
    handleChange,
    handleSubmit,
    values,
    handleBlur,
    touched,
    isValid,
    isSubmitting,
    setSubmitting,
  } = useFormik({
    initialValues: {
      email: '',
    },
    onSubmit: async (values) => {
      if (!isValid) return
      setSubmitting(true)
      try {
        await addEmailToWaitlist({
          variables: {
            email: values.email,
          },
        })
        setShowQueue(true)
      } catch (e) {
        toast(e as string, {
          type: 'error',
        })
      }
      setSubmitting(false)
    },
    validationSchema: yup.object({
      email: yup
        .string()
        .email("Hmm...that doesn't look like an email address. Try again.")
        .required('Please provide your email.'),
    }),
  })

  useEffect(() => {
    if (!data) return
    emitToast({
      title: 'Added to waitlist',
      description: 'Please check your email to confirm!',
      type: 'success',
    })
  }, [data])

  useEffect(() => {
    if (!error) return
    emitToast({
      title: 'Error',
      description: error.message,
      type: 'error',
    })
  }, [error])

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
            'justify-center': showQueue,
          }
        )}
      >
        <div className="flex">
          <div className="h-32 w-32 bg-gray-200 rounded-full z-0" />
          <div className="h-32 w-32 rounded-full backdrop-filter backdrop-blur-xl -ml-32 z-20" />
          <div className="h-24 w-24 bg-brand rounded-full -ml-10 z-10" />
        </div>
        {!showQueue && (
          <Text className="mt-8 font-black text-3xl">
            Join the waitlist to Incredible
          </Text>
        )}
        {showQueue && (
          <div className="px-14">
            <Text className="mt-8 font-black text-3xl flex flex-col mb-4">
              <span> Check your mail for a confirmation link </span>
            </Text>
            <Text>
              We’ve sent a confirmation link to{' '}
              <span className="font-bold">{values.email}</span> Please confirm
              to join the waitlist.
            </Text>
            <div className="grid grid-cols-2 gap-x-4 mt-8">
              <button
                type="button"
                className={cx(
                  'font-semibold group border transition-all flex justify-center items-center rounded-md cursor-pointer w-full py-3 border-gray-300 mt-4'
                )}
                onClick={() =>
                  window.open('https://mail.google.com/', '_blank')
                }
              >
                <img src={gmail} alt="gmail-logo" className="mr-2" />
                Open Gmail
              </button>
              <button
                type="button"
                className={cx(
                  'font-semibold group border transition-all flex justify-center items-center rounded-md cursor-pointer w-full py-3 border-gray-300 mt-4'
                )}
                onClick={() =>
                  window.open('https://outlook.office.com/mail/', '_blank')
                }
              >
                <img src={outlook} alt="gmail-logo" className="mr-2" />
                Open Outlook
              </button>
            </div>
          </div>
        )}
      </div>
      {!showQueue && (
        <div className="w-full h-full flex flex-col flex-shrink items-center justify-start col-start-5 col-end-9 px-10">
          <TextField
            label=""
            type="email"
            name="email"
            placeholder="Email address"
            className="mb-2 mt-6"
            onBlur={handleBlur}
            value={values.email}
            onChange={(e) => {
              handleChange(e)
            }}
            caption={touched.email && errors.email ? errors.email : undefined}
          />
          <Button
            type="button"
            className="w-full py-3 mt-4"
            appearance="primary"
            size="small"
            disabled={!isValid}
            onClick={(e) => {
              e?.preventDefault()
              handleSubmit()
            }}
            loading={isSubmitting}
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  )
}

export default JoinWaitlist
