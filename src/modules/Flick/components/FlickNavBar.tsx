import React, { useEffect, useState } from 'react'
import { FiBell, FiChevronLeft, FiLink2, FiUpload } from 'react-icons/fi'
import { useRecoilState } from 'recoil'
import { FlickActivity } from '.'
import { Button, Heading, Text } from '../../../components'
import config from '../../../config'
import { ASSETS } from '../../../constants'
import { useUpdateFlickMutation } from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'
import ShareModal from './ShareModal'

const FlickNavBar = ({ toggleModal }: { toggleModal: (val: true) => void }) => {
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const [isActivityMenu, setIsActivityMenu] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [editFlickName, setEditFlickName] = useState(false)
  const [flickName, setFlickName] = useState(flick?.name || '')

  const [updateFlickMutation, { data }] = useUpdateFlickMutation()

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

  useEffect(() => {
    if (!data) return
    if (flick) {
      setFlickStore((prev) => ({
        ...prev,
        flick: {
          ...flick,
          name: flickName,
          fragments: [
            ...flick.fragments.map((fragment) => ({
              ...fragment,
              flick: {
                ...fragment.flick,
                name: flickName,
              },
            })),
          ],
        },
      }))
    }
  }, [data])

  return (
    <div className="flex items-center justify-between py-2 pl-3 pr-4 border-b border-gray-300 bg-gray-50">
      <div className="flex items-center">
        <a href={`${config.client.publicUrl}/dashboard`}>
          <div className="flex">
            <FiChevronLeft size={28} className="mr-2 text-gray-700" />
            <img src={ASSETS.ICONS.StudioLogo} alt="" className="w-28" />
          </div>
        </a>
        <Heading
          className="p-2 ml-12 font-semibold rounded-md text-md hover:bg-gray-100"
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
      <div className="flex items-center gap-x-6">
        <Button
          appearance="link"
          icon={FiLink2}
          type="button"
          onClick={() => {
            setIsShareOpen(true)
          }}
          size="small"
          className="-mr-3"
        >
          Invite
        </Button>
        <FiBell
          className="text-gray-600 cursor-pointer"
          size={21}
          onClick={() => setIsActivityMenu(!isActivityMenu)}
        />
        <Button
          appearance="primary"
          size="small"
          icon={FiUpload}
          type="button"
          onClick={async () => {
            toggleModal(true)
          }}
        >
          <Text className="text-sm">Publish</Text>
        </Button>
      </div>
      <div className="absolute right-0">
        <FlickActivity menu={isActivityMenu} setMenu={setIsActivityMenu} />
      </div>
      <ShareModal
        open={isShareOpen}
        handleClose={() => {
          setIsShareOpen(false)
        }}
      />
    </div>
  )
}

export default FlickNavBar
