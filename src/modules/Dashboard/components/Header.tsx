import React from 'react'
import { IconType } from 'react-icons'
import { HiOutlineSparkles, HiOutlineDownload } from 'react-icons/hi'
import { IoCopyOutline, IoAddOutline } from 'react-icons/io5'
import { Heading, Text } from '../../../components'

enum OptionType {
  blank = 'blank',
  local = 'local',
  link = 'link',
}

interface Option {
  icon: IconType
  color: string
  title: string
  description: string
  type: OptionType
}

const options: Option[] = [
  {
    icon: HiOutlineSparkles,
    color: 'incredible-green',
    title: 'Create blank flick',
    description: 'New flick with empty markdown',
    type: OptionType.blank,
  },
  {
    icon: HiOutlineDownload,
    color: 'incredible-purple',
    title: 'Import local markdown',
    description: 'New flick with local markdown',
    type: OptionType.local,
  },
  {
    icon: IoCopyOutline,
    color: 'incredible-blue',
    title: 'Paste markdown link',
    description: 'New flick with markdown from link',
    type: OptionType.link,
  },
]

const Card = ({ color, description, icon: I, title, type }: Option) => {
  return (
    <div className="bg-dark-400 rounded-md flex justify-between items-center p-4 cursor-pointer">
      <div className={`bg-${color}-light-600 p-2 rounded-sm`}>
        <I size={24} className={`text-${color}-600`} />
      </div>
      <div className="flex-1 mx-4">
        <Heading fontSize="base">{title}</Heading>
        <Text className="text-dark-title" fontSize="normal">
          {description}
        </Text>
      </div>
      <div>
        <IoAddOutline size={16} className="text-dark-title" />
      </div>
    </div>
  )
}

const Header = () => {
  return (
    <div className="grid grid-cols-3 gap-y-4 gap-x-8 grid-flow-col">
      {options.map((option) => (
        <Card key={option.type} {...option} />
      ))}
    </div>
  )
}

export default Header
