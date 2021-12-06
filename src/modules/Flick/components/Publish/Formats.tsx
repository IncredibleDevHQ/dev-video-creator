import React, { useContext } from 'react'
import { cx } from '@emotion/css'
import { PublishContext } from './PublishFlick'
import { Heading, Text } from '../../../../components'
import { ASSETS } from '../../../../constants'

export enum FormatEnum {
  flick = 'Flick',
  blog = 'Blog',
  devShorts = 'Highlights',
}

export interface Format {
  name: string
  description: string
  icon: string
}

const formats: Format[] = [
  {
    name: FormatEnum.flick,
    description: 'Landscape videos, suited for deep-dive content',
    icon: ASSETS.ICONS.FLICK,
  },
  {
    name: FormatEnum.blog,
    description: 'Blogs with markdown support',
    icon: ASSETS.ICONS.BLOG,
  },
  {
    name: FormatEnum.devShorts,
    description: 'Short portrait videos',
    icon: ASSETS.ICONS.SHORTS,
  },
]

const FormatCard = ({
  format,
  disabled,
}: {
  format: Format
  disabled: boolean
}) => {
  const { selectedFormats, setSelectedFormats } = useContext(PublishContext)
  const index = selectedFormats?.findIndex((f) => f.name === format.name)

  const toggleSelection = () => {
    if (index === -1) {
      setSelectedFormats([...selectedFormats, format])
    } else {
      setSelectedFormats(selectedFormats?.filter((f) => f.name !== format.name))
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={() => null}
      className={cx(
        'py-5 px-4 my-4 flex justify-start items-center border rounded-md',
        {
          'border-gray-200': index === -1,
          'border-brand': index !== -1,
          'text-gray-400 cursor-not-allowed': disabled,
        }
      )}
      onClick={() => !disabled && toggleSelection()}
    >
      <img
        src={format.icon}
        alt={format.name}
        className={cx('w-9', { 'filter grayscale': disabled })}
      />
      <div className="ml-2">
        <Heading
          fontSize="small"
          className={cx('font-bold leading-none font-main text-gray-800', {
            'text-gray-600': disabled,
          })}
        >
          {format.name}
        </Heading>
        <Text
          fontSize="small"
          className="leading-none font-body mt-2 text-gray-600"
        >
          {format.description}
        </Text>
      </div>
    </div>
  )
}

const Formats = ({
  isFlick,
  isShorts,
}: {
  isFlick: boolean
  isShorts: boolean
}) => {
  return (
    <div className="mt-4">
      <Text className="text-sm font-body text-gray-600">
        Select the formats you’d like to publish. You can always come back later
        and publish the rest.
      </Text>
      {formats.map((format) => {
        const isDisabled =
          (format.name === FormatEnum.flick && !isFlick) ||
          (format.name === FormatEnum.devShorts && !isShorts)
        return (
          <FormatCard key={format.name} format={format} disabled={isDisabled} />
        )
      })}
    </div>
  )
}

export default Formats
