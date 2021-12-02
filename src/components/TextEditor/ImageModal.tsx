import React, { useCallback, useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { cx, css } from '@emotion/css'
import { Modal } from 'react-responsive-modal'
import { FiUploadCloud } from 'react-icons/fi'
import Dropzone from 'react-dropzone'
import { BiSave } from 'react-icons/bi'
import { Button, Heading, Label, TextField, Text } from '..'
import { useUploadFile } from '../../hooks'

const ImageModalSchema = Yup.object().shape({
  url: Yup.string().url().required('Required'),
})

const ImageModal = ({
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
    validationSchema: ImageModalSchema,
    onSubmit: async (values) => {
      handleUrl(values.url)
    },
    validateOnMount: true,
  })

  const [uploadImage] = useUploadFile()

  const [loading, setLoading] = useState(false)

  const handleDrop = useCallback(async ([file]: File[]) => {
    setLoading(true)
    const { url } = await uploadImage({
      // @ts-ignore
      extension: file.name.split('.')[1],
      file,
    }).finally(() => setLoading(false))

    handleUrl(url)
  }, [])

  return (
    <Modal
      open={open}
      onClose={handleClose}
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
            <Heading fontSize="medium">Add your image link</Heading>
          </div>

          <div className="flex flex-col mt-4">
            <Dropzone onDrop={handleDrop} accept="image/*" maxFiles={1}>
              {({ getRootProps, getInputProps }) => (
                <div
                  className="border border-dashed border-gray-200 flex flex-col items-center p-2 rounded-md cursor-pointer"
                  {...getRootProps()}
                >
                  <input {...getInputProps()} />
                  <FiUploadCloud size={24} className="my-2" />

                  <div className="text-center">
                    <Text fontSize="small">Drag and drop or</Text>
                    <Text fontSize="small" className="font-semibold">
                      browse
                    </Text>
                  </div>
                </div>
              )}
            </Dropzone>
            <div className="flex w-full justify-center">
              <Label className="mt-1">OR</Label>
            </div>
            <div>
              <TextField
                onChange={handleChange}
                name="url"
                value={values.url}
                type="text"
                placeholder="Link"
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
                {loading ? 'Uploading...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ImageModal
