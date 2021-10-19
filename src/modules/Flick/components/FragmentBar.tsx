import React, { useState, useEffect } from 'react'
import { BiPlay, BiPlayCircle } from 'react-icons/bi'
import { BsCameraVideo, BsGear } from 'react-icons/bs'
import { IoTrashOutline, IoCopyOutline } from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import {
  DeleteFragmentModal,
  DuplicateFragmentModal,
  FragmentVideoModal,
} from '.'
import { Button, emitToast } from '../../../components'
import { useGetFlickFragmentsLazyQuery } from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'
import SettingsModal from './SettingsModal'

const FragmentBar = () => {
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(false)
  const [settingsModal, setSettingsModal] = useState(false)
  const [fragmentVideoModal, setFragmetVideoModal] = useState(false)
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const history = useHistory()

  const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)

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
      <div className="flex items-center">
        <BsGear
          size={24}
          className="mr-8 text-gray-600 cursor-pointer"
          onClick={() => setSettingsModal(true)}
        />
        {fragment?.producedLink && (
          <div
            className="flex items-center mr-4 border border-green-600 rounded-md px-2 cursor-pointer"
            onClick={() => {
              setFragmetVideoModal(true)
            }}
          >
            <BiPlayCircle size={32} className="text-green-600" />
          </div>
        )}
        <Button
          appearance="secondary"
          size="small"
          icon={BsCameraVideo}
          type="button"
          onClick={() => history.push(`/${activeFragmentId}/studio`)}
        >
          Launch Studio
        </Button>
      </div>
      <FragmentVideoModal
        open={fragmentVideoModal}
        handleClose={() => {
          setFragmetVideoModal(false)
        }}
      />
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
      <SettingsModal
        open={settingsModal}
        handleClose={() => {
          setSettingsModal(false)
        }}
      />
    </div>
  )
}

export default FragmentBar
