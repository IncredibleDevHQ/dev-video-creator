/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import Modal from 'react-responsive-modal'
import { css, cx } from '@emotion/css'
import React, { useEffect } from 'react'
import { IoTrashOutline } from 'react-icons/io5'
import { FiEdit } from 'react-icons/fi'
import { Link, useHistory } from 'react-router-dom'
import { emitToast, Heading, ScreenState } from '../../../components'
import { useDeleteFlickMutation } from '../../../generated/graphql'

const MoreOptionsModal = ({
  open,
  handleClose,
  flickId,
}: {
  open: boolean
  handleClose: () => void
  flickId: string
}) => {
  const [deleteFlick, { data, loading }] = useDeleteFlickMutation()
  const history = useHistory()
  const deleteFlickFunction = async () => {
    await deleteFlick({
      variables: {
        flickId,
      },
    })
  }

  useEffect(() => {
    if (!data) return
    emitToast({
      title: 'Success',
      description: 'Successfully deleted the flick',
      type: 'success',
    })
    history.push('/dashboard')
  }, [data])

  if (loading) return <ScreenState title="Just a jiffy" loading />

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
        <Heading className="text-xs ml-4" onClick={deleteFlickFunction}>
          Delete
        </Heading>
      </div>
    </Modal>
  )
}

export default MoreOptionsModal
