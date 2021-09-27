import Modal from 'react-responsive-modal'
import { css, cx } from '@emotion/css'
import React from 'react'
import { IoTrashOutline } from 'react-icons/io5'
import { FiEdit } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { Heading } from '../../../components'

const MoreOptionsModal = ({
  open,
  handleClose,
  flickId,
}: {
  open: boolean
  handleClose: () => void
  flickId: string
}) => {
  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg  ',
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
      <Link to={`/flick/${flickId}`} replace>
        <div className=" flex flex-row mr-4 mb-3 ml-4 mt-6 w-auto">
          <FiEdit />
          <Heading className="text-xs ml-4"> Edit in Studio </Heading>
        </div>
      </Link>
      <div className=" flex flex-row mr-4 mb-3 ml-4 mt-6 w-auto">
        <IoTrashOutline />
        <Heading className="text-xs ml-4"> Delete </Heading>
      </div>
    </Modal>
  )
}

export default MoreOptionsModal
