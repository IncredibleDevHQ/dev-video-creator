/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { sentenceCase } from 'change-case'
import React, { useEffect, useState } from 'react'
import { IoDocumentTextOutline } from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { Heading, Text, ThumbnailPreview } from '../../../components'
import { ASSETS } from '../../../constants'
import {
  Content_Type_Enum_Enum,
  DashboardFlicksFragment,
  OrientationEnum,
} from '../../../generated/graphql'

const FlickTile = ({
  id,
  name,
  status,
  contents,
  thumbnail,
  theme,
}: DashboardFlicksFragment) => {
  const history = useHistory()

  return (
    <div
      className="border border-dark-300 rounded-md cursor-pointer"
      onClick={() => history.push(`/flick/${id}`)}
    >
      <div
        className="flex items-center justify-center bg-dark-300"
        style={{ height: 168 }}
      >
        {(() => {
          if (contents.length > 0) {
            if (contents[0]?.thumbnail && contents[0]?.preview) {
              return (
                <ThumbnailPreview
                  backgroundImageSource={contents[0]?.preview || ''}
                  posterImageSource={
                    contents[0]?.thumbnail || ASSETS.ICONS.FLICKBG
                  }
                  className="rounded-md"
                  orientation={
                    contents[0]?.type === Content_Type_Enum_Enum.Video
                      ? OrientationEnum.Landscape
                      : OrientationEnum.Portrait
                  }
                  totalImages={50}
                  size={{
                    width: 150,
                    height: 84,
                  }}
                  scale={1.8}
                />
              )
            }
            if (contents[1]?.thumbnail && contents[1]?.preview) {
              return (
                <ThumbnailPreview
                  backgroundImageSource={contents[1]?.preview || ''}
                  posterImageSource={
                    contents[1]?.thumbnail || ASSETS.ICONS.FLICKBG
                  }
                  className="rounded-md"
                  orientation={
                    contents[1]?.type === Content_Type_Enum_Enum.Video
                      ? OrientationEnum.Landscape
                      : OrientationEnum.Portrait
                  }
                  totalImages={50}
                  size={{
                    width: 150,
                    height: 84,
                  }}
                  scale={1.8}
                />
              )
            }
            return <IoDocumentTextOutline size={36} className="text-dark-700" />
          }
          return <IoDocumentTextOutline size={36} className="text-dark-700" />
        })()}
      </div>
      <div className="px-4 py-2">
        <Heading>{sentenceCase(name)}</Heading>
        <Text fontSize="small" className="text-dark-title my-1">
          Edited two weeks ago
        </Text>
      </div>
    </div>
  )
}

export default FlickTile
