import React from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { cx, css } from '@emotion/css'
import { Modal } from 'react-responsive-modal'
import { BiSave } from 'react-icons/bi'
import { Button, Heading, Label, TextField, Text } from '..'
import languages from './languages'

const LanguageModalSchema = Yup.object().shape({
  language: Yup.string().required('Required'),
})

const LanguageModal = ({
  handleClose,
  open,
  handleLanguage,
}: {
  handleClose: (shouldRefetch?: boolean) => void
  open: boolean
  handleLanguage: (language: string) => void
}) => {
  const { handleChange, handleSubmit, values, isValid } = useFormik({
    initialValues: {
      language: '',
    },
    validationSchema: LanguageModalSchema,
    onSubmit: async (values) => {
      handleLanguage(values.language)
    },
    validateOnMount: true,
  })

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
            <Heading fontSize="medium">Choose language</Heading>
          </div>

          <div className="flex flex-col mt-4">
            <select
              onChange={handleChange}
              value={values.language}
              name="language"
              className="p-2 border-brand rounded-md"
            >
              <option value="">Select language</option>
              {languages.map((language) => (
                <option key={language.name} value={language.name}>
                  {language.name}
                </option>
              ))}
            </select>

            <div className="mt-8 flex items-center justify-end">
              <Button
                icon={BiSave}
                type="button"
                appearance="primary"
                size="small"
                disabled={!isValid}
                onClick={() => handleSubmit()}
              >
                Insert
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default LanguageModal
