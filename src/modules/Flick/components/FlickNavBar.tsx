import React, { useEffect, useState } from 'react'
import { BsGear } from 'react-icons/bs'
import { FiBell, FiChevronLeft, FiLink2, FiUpload } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { Heading, Button, emitToast } from '../../../components'
import { ASSETS } from '../../../constants'
import {
  useProduceVideoMutation,
  useUpdateFlickMutation,
} from '../../../generated/graphql'
import { FlickActivity } from '.'
import { newFlickStore } from '../store/flickNew.store'
import SettingsModal from './SettingsModal'
import ShareModal from './ShareModal'

const FlickNavBar = ({ toggleModal }: { toggleModal: (val: true) => void }) => {
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const [isActivityMenu, setIsActivityMenu] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [settingsModal, setSettingsModal] = useState(false)
  const [editFlickName, setEditFlickName] = useState(false)
  const [flickName, setFlickName] = useState(flick?.name || '')

  const [updateFlickMutation, { data }] = useUpdateFlickMutation()

  const [produceVideoMutation, { loading }] = useProduceVideoMutation()

  const updateFlick = async (newName: string) => {
    if (editFlickName) {
      await updateFlickMutation({
        variables: {
          name: newName,
          flickId: flick?.id,
        },
      })
    }
  }

  const produceVideo = async (): Promise<string | undefined> => {
    try {
      const { errors, data } = await produceVideoMutation({
        variables: {
          flickId: flick?.id,
        },
      })
      if (errors) throw errors[0]

      return data?.ProduceVideo?.id
    } catch (e) {
      emitToast({
        title: 'Yikes. Something went wrong.',
        type: 'error',
        autoClose: false,
        description: 'Our servers are a bit cranky today. Try in a while?',
      })
      return undefined
    }
  }

  useEffect(() => {
    if (!data) return
    if (flick) {
      setFlickStore((prev) => ({
        ...prev,
        flick: { ...flick, name: flickName },
      }))
    }
  }, [data])

  return (
    <div className="flex justify-between items-center pr-4 pl-3 py-1 border-b border-gray-300 bg-white">
      <div className="flex items-center">
        <Link to="/dashboard">
          <div className="flex">
            <FiChevronLeft size={28} className="text-gray-700 mr-2" />
            <img src={ASSETS.ICONS.StudioLogo} alt="" className="w-28" />
          </div>
        </Link>
        <Heading
          className="text-md font-semibold ml-12 p-2 rounded-md hover:bg-gray-100"
          contentEditable={editFlickName}
          onMouseDown={() => setEditFlickName(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              setEditFlickName(false)
              setFlickName(e.currentTarget.innerText)
              updateFlick(e.currentTarget.innerText)
            }
          }}
        >
          {flick?.name}
        </Heading>
      </div>
      <div className="flex items-center">
        <BsGear
          size={21}
          className="mr-8 text-gray-600 cursor-pointer"
          onClick={() => setSettingsModal(true)}
        />
        <FiBell
          className="text-gray-600 mr-4 cursor-pointer"
          size={21}
          onClick={() => setIsActivityMenu(!isActivityMenu)}
        />
        <Button
          appearance="link"
          icon={FiLink2}
          type="button"
          onClick={() => {
            setIsShareOpen(true)
          }}
          className="mr-2"
        >
          Invite
        </Button>
        <ShareModal
          open={isShareOpen}
          handleClose={() => {
            setIsShareOpen(false)
          }}
        />
        <SettingsModal
          open={settingsModal}
          handleClose={() => {
            setSettingsModal(false)
          }}
        />
        <Button
          appearance="primary"
          size="small"
          icon={FiUpload}
          type="button"
          disabled={loading}
          className="px-3 py-1"
          onClick={async () => {
            // const success = await produceVideo()
            // if (success && success.length > 0)
            toggleModal(true)
          }}
        >
          {loading ? 'Producing Video...' : 'Publish'}
        </Button>
      </div>
      <div className="absolute right-0">
        <FlickActivity menu={isActivityMenu} setMenu={setIsActivityMenu} />
      </div>
    </div>
  )
}

export default FlickNavBar
