import React, { useState } from 'react'
import { FiBell, FiChevronLeft, FiUpload } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { Heading, Button } from '../../../components'
import { ASSETS } from '../../../constants'
import { FlickActivity } from '../../Flick/components'
import { newFlickStore } from '../store/flickNew.store'

const FlickNavBar = () => {
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const [isActivityMenu, setIsActivityMenu] = useState(false)

  return (
    <div className="flex justify-between items-center pr-6 pl-3 py-2">
      <div className="flex items-center">
        <Link to="/dashboard">
          <div className="flex">
            <FiChevronLeft size={32} className="text-gray-700 mr-2" />
            <img src={ASSETS.ICONS.StudioLogo} alt="" className="w-32" />
          </div>
        </Link>
        <Heading className="font-semibold ml-12">{flick?.name}</Heading>
      </div>
      <div className="flex items-center">
        <FiBell
          className="text-gray-600 mr-8 cursor-pointer"
          size={24}
          onClick={() => setIsActivityMenu(!isActivityMenu)}
        />
        <Button appearance="primary" size="small" icon={FiUpload} type="button">
          Publish
        </Button>
      </div>
      <div className="absolute right-0">
        <FlickActivity menu={isActivityMenu} setMenu={setIsActivityMenu} />
      </div>
    </div>
  )
}

export default FlickNavBar
