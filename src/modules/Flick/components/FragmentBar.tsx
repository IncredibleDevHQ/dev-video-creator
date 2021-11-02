import React, { useState, useEffect } from 'react'
import { BiPlayCircle } from 'react-icons/bi'
import { BsCameraVideo } from 'react-icons/bs'
import { RiStickyNoteLine } from 'react-icons/ri'
import { IoTrashOutline, IoCopyOutline, IoLogoMarkdown } from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import {
  DeleteFragmentModal,
  FragmentVideoModal,
  MarkdownModal,
  NotesModal,
} from '.'
import { Button, Text } from '../../../components'
import { useUpdateFragmentMutation } from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'

const FragmentBar = () => {
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false)
  const [fragmentVideoModal, setFragmetVideoModal] = useState(false)
  const [markdownModal, setMarkdownModal] = useState(false)
  const [notesModal, setNotesModal] = useState(false)
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const history = useHistory()

  const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)

  const [editFragmentName, setEditFragmentName] = useState(false)

  const [updateFragmentMutation, { data: updateFargmentData }] =
    useUpdateFragmentMutation()

  useEffect(() => {
    if (!updateFargmentData) return
    setEditFragmentName(false)
  }, [updateFargmentData])

  const updateFragment = async (newName: string) => {
    if (editFragmentName) {
      if (flick) {
        setFlickStore((store) => ({
          ...store,
          flick: {
            ...flick,
            fragments: flick.fragments.map((f) => {
              if (f.id === fragment?.id) {
                return { ...f, name: newName }
              }
              return f
            }),
          },
        }))
      }
      await updateFragmentMutation({
        variables: {
          fragmentId: fragment?.id, // value for 'fragmentId'
          name: newName,
        },
      })
    }
  }

  return (
    <div className="flex items-center bg-gray-50 justify-between -mt-1 pr-6 pl-3 py-2.5 border-t border-b border-gray-300">
      <div className="flex">
        <div className="flex items-center">
          <IoTrashOutline
            size={24}
            className="mr-6 ml-2 text-gray-600 cursor-pointer"
            onClick={() => setConfirmDeleteModal(true)}
          />
        </div>
        <div className="w-px mr-4 bg-gray-200" />
        <div className="flex items-center">
          <RiStickyNoteLine
            size={24}
            className="text-gray-600 cursor-pointer mr-10"
            onClick={() => setNotesModal(true)}
          />
          <IoLogoMarkdown
            size={24}
            className="text-gray-600 cursor-pointer"
            onClick={() => setMarkdownModal(true)}
          />
          <Text
            className="text-base font-bold text-gray-800 truncate overflow-ellipsis cursor-text rounded-md p-1 hover:bg-gray-100"
            contentEditable={editFragmentName}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => {
              setEditFragmentName(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setEditFragmentName(false)
                updateFragment(e.currentTarget.innerText)
              }
            }}
          >
            {fragment?.name}
          </Text>
        </div>
      </div>
      <div className="flex items-center">
        {fragment?.producedLink && (
          <div
            tabIndex={-1}
            role="button"
            onKeyDown={() => {}}
            className="flex items-center mr-4 border border-green-600 rounded-md px-2 cursor-pointer"
            onClick={() => {
              setFragmetVideoModal(true)
            }}
          >
            <BiPlayCircle size={32} className="text-green-600 py-1" />
          </div>
        )}
        <Button
          appearance="secondary"
          size="small"
          icon={BsCameraVideo}
          type="button"
          onClick={() => history.push(`/${activeFragmentId}/studio`)}
        >
          {fragment?.producedLink ? 'Retake' : 'Record'}
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
      <NotesModal
        open={notesModal}
        handleClose={() => {
          setNotesModal(false)
        }}
      />
      {flick && (
        <MarkdownModal
          open={markdownModal}
          flickId={flick.id}
          handleClose={() => {
            setMarkdownModal(false)
          }}
        />
      )}
    </div>
  )
}

export default FragmentBar
