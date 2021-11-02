import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { BiPlayCircle } from 'react-icons/bi'
import { BsCameraVideo } from 'react-icons/bs'
import { HiOutlinePencilAlt, HiOutlineTemplate } from 'react-icons/hi'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { FragmentVideoModal } from '.'
import { Button, Text } from '../../../components'
import { useUpdateFragmentMutation } from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'

const FragmentBar = () => {
  const [fragmentVideoModal, setFragmetVideoModal] = useState(false)
  const [{ flick, activeFragmentId, isMarkdown }, setFlickStore] =
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
    <div className="flex items-center bg-gray-50 justify-between pr-6 pl-6 py-2.5 border-t border-b border-gray-300">
      <div className="flex items-center">
        <div className="flex bg-gray-100 items-center rounded-md mr-6">
          <div
            role="button"
            onKeyUp={() => {}}
            tabIndex={0}
            onClick={() =>
              setFlickStore((store) => ({
                ...store,
                isMarkdown: true,
              }))
            }
            className={cx(
              'bg-gray-100 p-2 rounded-tl-md rounded-bl-md text-gray-600',
              {
                'bg-gray-200': isMarkdown,
              }
            )}
          >
            <HiOutlinePencilAlt size={21} />
          </div>
          <div
            role="button"
            onKeyUp={() => {}}
            tabIndex={0}
            onClick={() =>
              setFlickStore((store) => ({
                ...store,
                isMarkdown: false,
              }))
            }
            className={cx(
              'bg-gray-100 p-2 rounded-tr-md rounded-br-md text-gray-600',
              {
                'bg-gray-200': !isMarkdown,
              }
            )}
          >
            <HiOutlineTemplate size={21} />
          </div>
        </div>
        <Text
          className="text-lg font-bold text-gray-800 truncate overflow-ellipsis cursor-text rounded-md p-1 hover:bg-gray-100"
          contentEditable={editFragmentName}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={() => {
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
    </div>
  )
}

export default FragmentBar
