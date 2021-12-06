import React, { useCallback, useState } from 'react'
import Dropzone from 'react-dropzone'
import { BiImage, BiTrashAlt, BiX } from 'react-icons/bi'
import { FiUploadCloud } from 'react-icons/fi'
import { BlockComponentContext, TabItem, Uploading } from '.'
import { Tooltip, Text } from '../..'
import { useUploadFile } from '../../../hooks'
import { ImageBlockProps } from '../types'

const Image = () => {
  const { block, handleUpdateBlock } = React.useContext(BlockComponentContext)
  const [isOpen, setIsOpen] = useState(false)

  const handleUpload = ({ url, key }: { url: string; key: string }) => {
    const candidateBlock = { ...block } as ImageBlockProps

    candidateBlock.imageBlock.url = url
    candidateBlock.imageBlock.key = key

    handleUpdateBlock?.(candidateBlock)
    setIsOpen(false)
  }

  const handleRemoveImage = () => {
    const candidateBlock = { ...block } as ImageBlockProps

    candidateBlock.imageBlock.url = undefined
    candidateBlock.imageBlock.key = undefined

    handleUpdateBlock?.(candidateBlock)
  }

  const handleDelete = () => {
    const candidateBlock = { ...block } as ImageBlockProps

    if (!candidateBlock) return

    if (candidateBlock?.imageBlock) {
      // @ts-ignore
      candidateBlock.imageBlock = undefined
    }
    // @ts-ignore
    candidateBlock.type = undefined

    handleUpdateBlock?.(candidateBlock)
  }

  return (block as ImageBlockProps)?.imageBlock?.url ? (
    <div className="relative">
      <img
        className="w-auto max-h-40 rounded"
        src={(block as ImageBlockProps)?.imageBlock?.url}
        alt={(block as ImageBlockProps)?.imageBlock?.key}
      />
      <ul className="absolute grid-flow-col gap-x-1 left-4 bg-white shadow-md p-1 rounded text-sm grid bottom-4">
        <Tooltip
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          content={<UploadImage handleUpload={handleUpload} />}
          placement="top-start"
          triggerOffset={20}
        >
          <TabItem
            icon={BiImage}
            appearance="icon"
            label="Image"
            handleClick={() => setIsOpen(true)}
          />
        </Tooltip>
        <TabItem
          icon={BiTrashAlt}
          appearance="icon"
          label="Delete"
          handleClick={handleRemoveImage}
        />
      </ul>
    </div>
  ) : (
    <div className="bg-gray-50 flex items-center justify-between rounded-md py-2 pl-2 pr-12">
      <Tooltip
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        content={<UploadImage handleUpload={handleUpload} />}
        placement="top-start"
        triggerOffset={20}
      >
        <button
          onClick={() => {
            setIsOpen(true)
          }}
          type="button"
          className="text-sm flex items-center"
        >
          <BiImage className="mr-2" />
          Add image
        </button>
      </Tooltip>
      <button onClick={handleDelete} type="button">
        <BiX />
      </button>
    </div>
  )
}

const UploadImage = ({
  handleUpload,
}: {
  handleUpload: (props: { url: string; key: string }) => void
}) => {
  const [uploadImage] = useUploadFile()

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleDrop = useCallback(async ([file]: File[]) => {
    setLoading(true)
    const { url, uuid } = await uploadImage({
      // @ts-ignore
      extension: file.name.split('.').pop(),
      file,
      handleProgress: ({ percentage }) => {
        setProgress(percentage)
      },
    }).finally(() => setLoading(false))

    handleUpload({ url, key: uuid })
  }, [])

  return (
    <div
      style={{ minWidth: 240 }}
      className="rounded-md shadow-md bg-white p-4"
    >
      <Dropzone
        disabled={loading}
        onDrop={handleDrop}
        accept="image/*"
        maxFiles={1}
      >
        {({ getRootProps, getInputProps }) => (
          <div
            className="border border-dashed border-gray-200 flex flex-col items-center p-2 rounded-md cursor-pointer"
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            {loading ? (
              <div className="text-center">
                <Uploading progress={progress} />
              </div>
            ) : (
              <>
                <FiUploadCloud size={24} className="my-2" />

                <div className="text-center">
                  <Text fontSize="small">Drag and drop or</Text>
                  <Text fontSize="small" className="font-semibold">
                    browse
                  </Text>
                </div>
              </>
            )}
          </div>
        )}
      </Dropzone>
    </div>
  )
}

export default Image
