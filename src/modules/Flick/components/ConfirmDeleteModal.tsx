import React, { useEffect } from 'react'
import { Modal } from 'react-responsive-modal'
import { css, cx } from '@emotion/css'
import { Button, Text } from '../../../components'
import { useDeleteFragmentMutation } from '../../../generated/graphql'
import { useHistory } from 'react-router-dom'

const ConfirmDeleteModal = ({
  open,
  handleClose,
  fragmentId,
  fragmentName,
  flickId,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
  fragmentId: string
  fragmentName: string
  flickId: string
}) => {
  const [deleteFragment, { data: deleteFragmentData, loading: deleteLoading }] =
    useDeleteFragmentMutation()
  const history = useHistory()
  const deleteFragmentbyId = (fragmentId: string) => {
    deleteFragment({
      variables: {
        id: fragmentId,
      },
    })
  }

  useEffect(() => {
    if (!deleteFragmentData) return
    handleClose(true)
  }, [deleteFragmentData])

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
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
      <div className="flex w-100,h-100">
        <div className="flex-row">
          <Text className="text-xl item-center font-semibold mb-4">
            Are you sure you want to delete this Fragment?
          </Text>
        </div>

        <div className="flex gap-2">
          <Button
            appearance="secondary"
            type="button"
            onClick={() => {
              handleClose()
            }}
            className=" p-2 text-white rounded-lg mt-20 "
          >
            Cancel
          </Button>

          <Button
            appearance="danger"
            type="button"
            className="p-2 text-white rounded-lg mt-20 "
            onClick={(e) => {
              e?.preventDefault()
              history.push(`/flick/${flickId}`)
              deleteFragmentbyId(fragmentId)
            }}
            loading={deleteLoading}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDeleteModal
