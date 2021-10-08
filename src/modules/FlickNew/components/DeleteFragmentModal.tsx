import React, { useEffect } from 'react'
import { Modal } from 'react-responsive-modal'
import { css, cx } from '@emotion/css'
import { Button, Text } from '../../../components'
import { useDeleteFragmentMutation } from '../../../generated/graphql'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { newFlickStore } from '../store/flickNew.store'

const DeleteFragmentModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)

  const [deleteFragment, { data, loading }] = useDeleteFragmentMutation()

  const deleteFragmentbyId = () => {
    deleteFragment({
      variables: {
        id: activeFragmentId,
      },
    })
  }

  useEffect(() => {
    if (!data) return
    if (flick) {
      const newFragments = flick.fragments.filter(
        (fragment) => fragment.id !== activeFragmentId
      )
      const newFragmentsLength = newFragments.length || 0
      const newActiveFragmentId =
        newFragmentsLength > 0 ? newFragments[0].id : ''

      setFlickStore((store) => ({
        activeFragmentId: newActiveFragmentId,
        flick: {
          ...flick,
          fragments: newFragments,
        },
      }))
    }
    handleClose()
  }, [data])

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-1/3',
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
      showCloseIcon={false}
    >
      <div className="flex flex-col w-full justify-center items-center">
        <Text className="text-lg font-semibold">
          Are you sure you want to delete this Fragment?
        </Text>

        <div className="flex w-full justify-end mt-4">
          <Button
            appearance="secondary"
            type="button"
            onClick={() => {
              handleClose()
            }}
            className=" p-2 text-white rounded-lg mr-4"
          >
            Cancel
          </Button>

          <Button
            appearance="danger"
            type="button"
            className="p-2 text-white rounded-lg mr-4"
            onClick={(e) => {
              deleteFragmentbyId()
            }}
            loading={loading}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default DeleteFragmentModal
