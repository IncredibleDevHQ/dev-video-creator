import React from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { cx, css } from '@emotion/css'
import { Modal } from 'react-responsive-modal'
import { BiSave } from 'react-icons/bi'
import { Button, Heading, Label, TextField } from '..'

const VideoModalSchema = Yup.object().shape({
  url: Yup.string().url().required('Required'),
})

const VideoModal = ({
  handleClose,
  open,
  handleUrl,
}: {
  handleClose: (shouldRefetch?: boolean) => void
  open: boolean
  handleUrl: (url: string) => void
}) => {
  const { handleChange, handleSubmit, values, isValid } = useFormik({
    initialValues: {
      url: '',
    },
    validationSchema: VideoModalSchema,
    onSubmit: async (values) => {
      handleUrl(values.url)
    },
    validateOnMount: true,
  })

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
            <Heading fontSize="medium">Add your video link</Heading>
          </div>
          <div className="flex flex-col mt-4">
            <div>
              <Label>Link</Label>
              <TextField
                onChange={handleChange}
                name="url"
                value={values.url}
                type="text"
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

export default VideoModal
