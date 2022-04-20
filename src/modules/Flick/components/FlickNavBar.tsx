import React, { useState } from 'react'
import { FiChevronLeft } from 'react-icons/fi'
import { IoPeopleOutline } from 'react-icons/io5'
import { useRecoilState } from 'recoil'
import { Button, Heading } from '../../../components'
import { ASSETS } from '../../../constants'
import { newFlickStore } from '../store/flickNew.store'
import ShareModal from './ShareModal'

const FlickNavBar = () => {
  const [{ flick }] = useRecoilState(newFlickStore)
  const [isShareOpen, setIsShareOpen] = useState(false)

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between py-2 pl-3 pr-5 bg-dark-500">
      <div className="flex items-center">
        <a href="/dashboard">
          <div className="flex">
            <FiChevronLeft size={28} className="mr-2 text-grey-lighter" />
            <img src={ASSETS.ICONS.StudioLogo} alt="" className="w-28" />
          </div>
        </a>
      </div>
      <Heading className="p-2 ml-12 font-bold text-base text-white">
        {flick?.name || ''}
      </Heading>
      <div className="flex items-stretch gap-x-6 px-2">
        <Button
          appearance="gray"
          type="button"
          onClick={() => {
            setIsShareOpen(true)
          }}
          size="small"
          icon={IoPeopleOutline}
          iconSize={20}
          className="-mr-3"
        >
          Invite
        </Button>
      </div>
      {isShareOpen && (
        <ShareModal
          open={isShareOpen}
          handleClose={() => {
            setIsShareOpen(false)
          }}
        />
      )}
    </div>
  )
}

export default FlickNavBar
