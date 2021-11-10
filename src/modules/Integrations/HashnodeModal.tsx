import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import { cx, css } from '@emotion/css'
import { Modal } from 'react-responsive-modal'
import { BiSave } from 'react-icons/bi'
import { Button, Heading, Label, TextField } from '../../components'
import { useIntegrateHashnodeMutation } from '../../generated/graphql'

const HashnodeSchema = Yup.object().shape({
  username: Yup.string().required('Required'),
  accessToken: Yup.string().required('Required'),
})

const HashnodeModal = ({
  handleClose,
  open,
}: {
  handleClose: (shouldRefetch?: boolean) => void
  open: boolean
}) => {
  const [integrateHashnode, { loading }] = useIntegrateHashnodeMutation()

  const { handleChange, handleSubmit, values, isValid } = useFormik({
    initialValues: {
      accessToken: '',
      username: '',
    },
    validationSchema: HashnodeSchema,
    onSubmit: async (values) => {
      await integrateHashnode({ variables: values })
      handleClose(true)
    },
  })

  const [showPassword, setShowPassword] = useState(false)

  return (
    <Modal
      open={open}
      onClose={() => handleClose()}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-1/2',
          css`
            background-color: #fffffff !important;
          `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
    >
      <div>
        <div className="mx-4 my-2">
          <div className="flex items-center justify-between">
            <Heading fontSize="medium">Configure Hashnode</Heading>
          </div>
          <div className="my-4 bg-gray-100 rounded-md px-2 py-4">
            Get your Personal Access Token from your{' '}
            <a
              className="underline-link"
              href="https://hashnode.com/settings/developer"
            >
              Hashnode account
            </a>
            .
          </div>
          <div className="flex flex-col mt-4">
            <div className="mb-2">
              <Label>Username</Label>
              <TextField
                onChange={handleChange}
                name="username"
                value={values.username}
              />
            </div>
            <div>
              <Label>Personal Access Token</Label>
              <TextField
                onChange={handleChange}
                name="accessToken"
                value={values.accessToken}
                type={showPassword ? 'text' : 'password'}
                accessories={[
                  showPassword ? (
                    <FiEye onClick={() => setShowPassword(false)} />
                  ) : (
                    <FiEyeOff onClick={() => setShowPassword(true)} />
                  ),
                ]}
              />
            </div>

            <div className="mt-8 flex items-center justify-end">
              <Button
                icon={BiSave}
                type="button"
                appearance="primary"
                size="small"
                disabled={!isValid}
                onClick={() => handleSubmit()}
                loading={loading}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default HashnodeModal
