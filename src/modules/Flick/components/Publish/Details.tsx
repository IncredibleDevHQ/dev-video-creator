import axios from 'axios'
import React, { useContext, useState } from 'react'
import Dropzone from 'react-dropzone'
import { FiXCircle } from 'react-icons/fi'
import { IoCloudUploadOutline } from 'react-icons/io5'
import { OptionsType } from 'react-select'
import AsyncSelect from 'react-select/async'
import { useDebounce } from 'use-debounce'
import {
  emitToast,
  Heading,
  Text,
  TextArea,
  TextField,
} from '../../../../components'
import config from '../../../../config'
import { API } from '../../../../constants'
import { useUploadFile } from '../../../../hooks'
import { AllowedFileExtensions } from '../../../../hooks/use-upload-file'
import { PublishContext } from './PublishFlick'

const ThumbnailCard = ({
  thumbnail,
  updateThumbnail,
}: {
  thumbnail: string
  updateThumbnail: (thumbnail: string) => void
}) => {
  const [uploadImage] = useUploadFile()
  const [loading, setLoading] = useState(false)

  const uploadThumbnail = async (files: File[]) => {
    try {
      setLoading(true)
      // NOTE - Considering only first file, since only one thumbnail per format is allowed
      const file = files?.[0]
      if (!file) throw new Error('No file selected')
      const { uuid } = await uploadImage({
        file,
        extension: file.name.split('.').pop() as AllowedFileExtensions,
      })
      updateThumbnail(uuid)
      setLoading(false)
    } catch (error: any) {
      setLoading(false)
      emitToast({
        type: 'error',
        title: 'Failed to upload thumbnail',
        description: error.message,
        autoClose: 500,
      })
    }
  }

  const clearThumbnail = () => {
    updateThumbnail('')
  }

  return (
    <div>
      {thumbnail ? (
        <div className="h-20 w-40 object-contain rounded-md overflow-hidden relative font-body">
          <FiXCircle
            size={12}
            className="absolute top-1 right-1 cursor-pointer z-10"
            onClick={clearThumbnail}
          />
          <img src={config.storage.baseUrl + thumbnail} alt={thumbnail} />
        </div>
      ) : (
        <Dropzone onDrop={uploadThumbnail} accept="image/*" maxFiles={1}>
          {({ getRootProps, getInputProps }) => (
            <div
              className="border border-dashed border-gray-200 flex flex-col items-center p-2 rounded-md cursor-pointer"
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              <IoCloudUploadOutline size={24} className="my-2 text-gray-600" />
              {loading ? (
                <Text fontSize="small">Uploading...</Text>
              ) : (
                <div className="text-center text-gray-400">
                  <Text fontSize="small">Drag and drop or</Text>
                  <Text fontSize="small">browse</Text>
                </div>
              )}
            </div>
          )}
        </Dropzone>
      )}
    </div>
  )
}

const Details = () => {
  const { tags, setTags, flickDetails, setFlickDetails } =
    useContext(PublishContext)

  const updateThumbnail = (thumbnail: string) => {
    setFlickDetails({ ...flickDetails, thumbnail })
  }

  const fetchTags = async (
    inputValue: string
  ): Promise<OptionsType<{ label: string; value: string }>> => {
    const { data } = await axios.get(
      `${
        API.STACK_EXCHANGE.BASE_URL + API.STACK_EXCHANGE.TAGS
      }&inname=${inputValue}`
    )
    return (
      data?.items?.map((item: any) => {
        return { label: item.name, value: item.name }
      }) || []
    )
  }

  // NOTE - This calls the API after a wait of 500ms.
  const [fetchDebouncedTags] = useDebounce(fetchTags, 500)

  return (
    <div>
      <div className="my-4">
        <Heading
          fontSize="extra-small"
          className="font-bold text-base text-gray-800"
        >
          Basic Details
        </Heading>
        <Text fontSize="normal" className="font-body text-gray-600 mt-px">
          Title and description can be useful in helping viewers find your
          content.
        </Text>
        <TextField
          className="mt-2.5 border-none font-body text-gray-800"
          placeholder="Title"
          value={flickDetails?.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setFlickDetails({ ...flickDetails, title: e.target.value })
          }
        />
        <TextArea
          placeholder="Description"
          className="font-body mt-2 text-gray-800"
          value={flickDetails?.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setFlickDetails({ ...flickDetails, description: e.target.value })
          }
        />
      </div>
      <div className="mt-8">
        <Heading
          fontSize="extra-small"
          className="font-bold text-base text-gray-800"
        >
          Thumbnail
        </Heading>
        <Text fontSize="normal" className="font-body text-gray-600 mt-px">
          Upload a thumbnail that shows what is in your video. If you don’t
          upload a thumbnail, we will generate one from the video.
        </Text>
        <div className="grid grid-flow-col grid-cols-3 gap-x-3 gap-y-2 mt-3">
          <ThumbnailCard
            thumbnail={flickDetails?.thumbnail}
            updateThumbnail={updateThumbnail}
          />
        </div>
      </div>
      <div className="mt-8">
        <Heading
          fontSize="extra-small"
          className="font-bold text-base text-gray-800"
        >
          Tags
        </Heading>
        <Text fontSize="normal" className="font-body text-gray-600 mt-px">
          Tags are descriptive keywords you can add to your video to help
          viewers find your content.
        </Text>
        <AsyncSelect
          isClearable
          isMulti
          cacheOptions
          value={tags?.map((tag: string) => {
            return { label: tag, value: tag }
          })}
          className="mt-3 border-none font-body text-gray-800"
          onChange={(selectedValue) =>
            setTags(selectedValue.map((t) => t.value))
          }
          noOptionsMessage={() => 'Start by typing something...'}
          loadOptions={(inputValue) => fetchDebouncedTags(inputValue)}
        />
      </div>
    </div>
  )
}

export default Details
