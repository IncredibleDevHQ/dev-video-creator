import React, { useState, useEffect } from 'react'
import { BsCameraVideo } from 'react-icons/bs'
import { IoTrashOutline, IoCopyOutline } from 'react-icons/io5'
import { useRecoilState } from 'recoil'
import { DeleteFragmentModal, DuplicateFragmentModal } from '.'
import { Button, emitToast } from '../../../components'
import { useGetFlickFragmentsLazyQuery } from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'

const FragmentBar = () => {
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(false)
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)

  const [GetFlickFragments, { data, error, refetch }] =
    useGetFlickFragmentsLazyQuery({
      variables: {
        flickId: flick?.id,
      },
    })

  useEffect(() => {
    if (!data || !flick) return
    setFlickStore((store) => ({
      ...store,
      flick: {
        ...flick,
        fragments: [...data.Fragment],
      },
    }))
  }, [data])

  useEffect(() => {
    if (!error || !refetch) return
    emitToast({
      title: "We couldn't fetch your new fragment",
      type: 'error',
      description: 'Click this toast to give it another try',
      onClick: () => refetch(),
    })
  }, [error])

  return (
    <div className="flex items-center bg-gray-50 justify-between pr-6 pl-3 py-2 border-t border-b border-gray-300">
      <div className="flex">
        <IoTrashOutline
          size={24}
          className="mr-8 ml-2 text-gray-600 cursor-pointer"
          onClick={() => setConfirmDeleteModal(true)}
        />
        <IoCopyOutline
          size={24}
          className="text-gray-600 cursor-pointer"
          onClick={() => setDuplicateModal(true)}
        />
      </div>
      <Button
        appearance="secondary"
        size="small"
        icon={BsCameraVideo}
        type="button"
      >
        Record
      </Button>
      <DeleteFragmentModal
        open={confirmDeleteModal}
        handleClose={() => {
          setConfirmDeleteModal(false)
        }}
      />
      <DuplicateFragmentModal
        open={duplicateModal}
        handleClose={(refresh) => {
          if (refresh) {
            GetFlickFragments()
          }
          setDuplicateModal(false)
        }}
      />
    </div>
  )
}

export default FragmentBar
