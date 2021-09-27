import Modal from 'react-responsive-modal'
import { css, cx } from '@emotion/css'
import React from 'react'
import { IoShareSocialOutline, IoTrashOutline } from 'react-icons/io5'
import { FiEdit } from 'react-icons/fi'
import { ASSETS } from '../../../constants'
import { Button, Heading, TextArea, TextField } from '../../../components'

const RequestAccessModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-1/3 ',
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
      <Heading className="text-base m-8">
        Get access to Incredible and create amazing developer flicks in just 60
        secs!
      </Heading>
      <div className="flex flex-row mt-4">
        <TextField
          className="text-sm m-4"
          onClick={() => {
            console.log('jhgf')
          }}
          placeholder="Email address"
          label=""
        />
        <Button size="small" appearance="primary" type="button">
          Request
        </Button>
      </div>
    </Modal>
  )
}

export default RequestAccessModal
