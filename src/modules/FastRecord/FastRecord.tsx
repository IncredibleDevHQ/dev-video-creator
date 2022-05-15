import React from 'react'
import { IoEllipse } from 'react-icons/io5'
import { Button, Logo } from '../../components'
import config from '../../config'
import { useQuery } from '../../hooks'
import { VideoEditor } from '../Flick/components'
import { Transformations } from '../Flick/editor/blocks/VideoEditor'
import FastVideoEditor from './FastVideoEditor'

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
  const [transformations, setTransformations] = React.useState<Transformations>(
    initalTransformations
  )
  const query = useQuery()
  const videoId = query.get('videoId')

  return (
    <>
      <Navbar />
      <div className="flex-1 my-auto flex items-center justify-center w-full h-full mt-4">
        <FastVideoEditor
          handleAction={(transformations) =>
            setTransformations(transformations)
          }
          url={`${baseUrl}${videoId}`}
          width={720}
          action="Save"
          transformations={{
            clip: transformations.clip || {},
            crop: transformations.crop,
          }}
        />
      </div>
    </>
  )
}

export default FastRecord
