import React from 'react'
import { BiBrush, BiText } from 'react-icons/bi'
import { FaCode, FaRedo, FaUndo } from 'react-icons/fa'
import { AiOutlinePicture } from 'react-icons/ai'
import { BsBag } from 'react-icons/bs'
import { IoColorFill } from 'react-icons/io5'
import { FiHexagon } from 'react-icons/fi'
import { Separator } from '.'
import { Button } from '../../../components'

const Toolbar = () => {
  return (
    <nav className="flex items-center justify-between bg-gray-100 shadow-sm px-6">
      <div className="grid grid-flow-col gap-x-6 text-gray-600 py-2">
        <FaUndo size={24} />
        <FaRedo size={24} />
        <Separator size={24} />
        <BiText size={24} />
        <AiOutlinePicture size={24} />
        <FiHexagon size={24} />
        <FaCode size={24} />
      </div>
      <div className="grid grid-flow-col text-gray-600 py-2">
        <Button type="button" size="medium" appearance="link" icon={BsBag}>
          Templates
        </Button>
        <Button type="button" size="medium" appearance="link" icon={BiBrush}>
          Theme
        </Button>
        <Button
          type="button"
          size="medium"
          appearance="link"
          icon={IoColorFill}
        >
          Background
        </Button>
      </div>
    </nav>
  )
}

export default Toolbar
