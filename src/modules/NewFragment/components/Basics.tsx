import { cx } from '@emotion/css'
import React, { ChangeEvent, useState } from 'react'
import { HTMLAttributes } from 'react'
import { BiArrowBack, BiRightArrowAlt } from 'react-icons/bi'
import { Form } from '.'
import { Button, TextArea, TextField } from '../../../components'

const Basics = ({
  className,
  handlePrevious,
  handleNext,
  form,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  handlePrevious: (props: { name: string; description?: string }) => void
  handleNext: (props: { name: string; description?: string }) => void
  form: Form
}) => {
  const [name, setName] = useState(form.name)
  const [description, setDescription] = useState(form.description)

  return (
    <>
      <div className={cx('flex flex-col', className)} {...rest}>
        <TextField
          label="Title"
          required
          placeholder="A Peak into Segmented Stacks"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
        />
        <TextArea
          className="mt-4"
          rows={3}
          label="Description"
          placeholder="The goal of this Fragment is to demonstrate and explain segmented stacks at compile time."
          value={description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setDescription(e.target.value)
          }
        />
      </div>
      <div className="flex items-center justify-between mt-8">
        <div>
          <Button
            appearance="link"
            icon={BiArrowBack}
            onClick={() => handlePrevious({ name, description })}
            type="button"
          >
            Previous
          </Button>
        </div>
        <div className="flex items-center">
          <Button
            appearance="primary"
            type="button"
            icon={BiRightArrowAlt}
            iconPosition="right"
            disabled={name.trim().length === 0}
            onClick={() => handleNext({ name, description })}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  )
}

export default Basics
