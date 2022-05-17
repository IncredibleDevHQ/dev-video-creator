/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable consistent-return */
import React, { useEffect } from 'react'
import { nanoid } from 'nanoid'
import { cx } from '@emotion/css'
import { IoEllipse } from 'react-icons/io5'
import { Button, Logo } from '../../components'
import config from '../../config'
import { useQuery } from '../../hooks'
import FastVideoEditor, {
  Transformations,
  VideoConfig,
} from './FastVideoEditor'

const initalTransformations: Transformations = {
  clip: {
    start: 0,
    end: 0,
    change: 'start',
  },
  crop: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
}

const initialVideoConfig: VideoConfig[] = []

const Navbar = () => {
  return (
    <div className="flex bg-gray-900 justify-between items-center py-4 px-8">
      <Logo size="small" theme="dark" />
      <div className="flex justify-end items-center">
        <Button
          type="button"
          size="small"
          appearance="primary"
          className="mx-4"
        >
          <p className="text-sm">Add to notebook</p>
        </Button>
        <Button
          type="button"
          size="small"
          appearance="gray"
          icon={IoEllipse}
          className="text-red-600"
        >
          <p className="text-sm text-white">Record</p>
        </Button>
      </div>
    </div>
  )
}

const FastRecord = () => {
  const { baseUrl } = config.storage
  const [videosConfig, setVideosConfig] =
    React.useState<VideoConfig[]>(initialVideoConfig)
  const [activeVideoConfig, setActiveVideoConfig] =
    React.useState<VideoConfig>()

  console.log(videosConfig)

  const query = useQuery()
  const videoId = query.get('videoId')
  const duration = parseInt(query.get('duration') || '0', 10) / 1000

  useEffect(() => {
    if (!videoId) return
    const url = `${baseUrl}${videoId}`
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const id = nanoid()
      setActiveVideoConfig({
        ...activeVideoConfig,
        id,
        start: 0,
        end: duration || video.duration || 0,
        duration: duration || video.duration || 0,
        transformations: {
          ...initalTransformations,
          clip: {
            ...initalTransformations.clip,
            start: 0,
            end: duration || video.duration || 0,
          },
        },
      })
    }
    video.src = url

    return () => {
      video.remove()
    }
  }, [videoId])

  const updateVideoConfig = (activeVideoConfig: VideoConfig) => {
    const tempVideoConfig = [...videosConfig]
    const index = tempVideoConfig.findIndex(
      (video) => video.id === activeVideoConfig.id
    )
    if (index === -1) {
      tempVideoConfig.push(activeVideoConfig)
    } else {
      tempVideoConfig[index] = activeVideoConfig
    }
    setVideosConfig(tempVideoConfig)
  }

  useEffect(() => {
    if (!activeVideoConfig) return
    updateVideoConfig(activeVideoConfig)
  }, [activeVideoConfig])

  return (
    <div className="flex flex-col items-stretch justify-between min-h-screen">
      <Navbar />
      <div className="flex-1 my-auto flex items-center justify-center w-full h-full mt-4">
        {activeVideoConfig && (
          <FastVideoEditor
            width={720}
            url={`${baseUrl}${videoId}`}
            totalDuration={duration || 0}
            videosConfig={videosConfig}
            setVideosConfig={setVideosConfig}
            activeVideoConfig={activeVideoConfig}
            setActiveVideoConfig={setActiveVideoConfig}
          />
        )}
      </div>
      <div className="w-full flex justify-start bg-gray-900 p-4 mt-2">
        {videosConfig.map((videoConfig) => (
          <div
            className={cx('w-32 h-16 bg-gray-700 rounded-md mr-4 border', {
              'border-brand': videoConfig.id === activeVideoConfig?.id,
              'border-transparent': videoConfig.id !== activeVideoConfig?.id,
            })}
            key={videoConfig.id}
            onClick={() => setActiveVideoConfig(videoConfig)}
          />
        ))}
      </div>
    </div>
  )
}

export default FastRecord
