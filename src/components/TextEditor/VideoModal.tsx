/* eslint-disable jsx-a11y/media-has-caption */
import React, { useCallback, useEffect, useState } from 'react'
import mime from 'mime'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import useScreenRecorder from 'use-screen-recorder'
import axios from 'axios'
import { cx, css } from '@emotion/css'
import { Modal } from 'react-responsive-modal'
import { BiSave, BiTrash, BiVideoRecording } from 'react-icons/bi'
import { FiUploadCloud } from 'react-icons/fi'
import Dropzone from 'react-dropzone'
import { Button, Heading, Label, TextField, Text, emitToast } from '..'
import { useUploadFile } from '../../hooks'
import { VideoEditor } from '../../modules/Flick/components'
import { Transformations } from '../../modules/Flick/components/VideoEditor'

const VideoModalSchema = Yup.object().shape({
  url: Yup.string().url().required('Required'),
})

const VideoModal = ({
  handleClose,
  open,
  handleAddVideo,
}: {
  handleClose: (shouldRefetch?: boolean) => void
  open: boolean
  handleAddVideo?: (url: string, transformations?: Transformations) => void
}) => {
  const { handleChange, handleSubmit, values, isValid } = useFormik({
    initialValues: {
      url: '',
    },
    validationSchema: VideoModalSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true)
        const { data } = await axios.get(values.url, { responseType: 'blob' })

        const blob = new Blob([data])

        handleFileSubmit(blob, values.url.split('.').pop())
      } catch (e) {
        if (typeof (e as any).response === 'undefined') {
          emitToast({
            type: 'error',
            title: 'Request failed.',
            description:
              'We ran into unknown issues while fetching that link. This might be due to the CORS policy set by the file server.',
          })
        } else {
          throw new Error((e as any).response.data.message)
        }

        setLoading(false)
      }
    },
    validateOnMount: true,
  })

  const [uploadVideo] = useUploadFile()

  const {
    blob,
    startRecording,
    stopRecording,
    status,
    resetRecording,
    blobUrl,
  } = useScreenRecorder({ audio: true })

  const [view, setView] = useState<'fileSource' | 'transform'>('fileSource')
  const [loading, setLoading] = useState(false)

  const [url, setUrl] = useState<string>()

  const handleDrop = useCallback(async ([file]: File[]) => {
    setLoading(true)
    const { url } = await uploadVideo({
      // @ts-ignore
      extension: file.name.split('.').pop(),
      file,
    }).finally(() => setLoading(false))

    setUrl(url)
    setView('transform')
  }, [])

  const handleFileSubmit = useCallback(
    async (blob: Blob, extension?: string) => {
      if (!blob) {
        throw Error(`Blob not found.`)
      }

      setLoading(() => true)
      const { url } = await uploadVideo({
        // @ts-ignore
        extension,
        file: blob,
      }).finally(() => setLoading(false))

      setUrl(url)
      setView('transform')
    },
    []
  )

  return (
    <Modal
      open={open}
      onClose={() => handleClose()}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-1/2',
          css`
            background-color: #fffffff !important;
          `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
    >
      {view === 'fileSource' ? (
        <div className="mx-4 my-2">
          <div className="flex items-center justify-between">
            <Heading fontSize="medium">Add your video link</Heading>
          </div>
          <div className="flex flex-col mt-4">
            <Dropzone onDrop={handleDrop} accept="video/*" maxFiles={1}>
              {({ getRootProps, getInputProps }) => (
                <div
                  className="border border-dashed border-gray-200 flex flex-col items-center p-2 rounded-md cursor-pointer"
                  {...getRootProps()}
                >
                  <input {...getInputProps()} />
                  <FiUploadCloud size={24} className="my-2" />

                  <div className="text-center">
                    <Text fontSize="small">Drag and drop or</Text>
                    <Text fontSize="small" className="font-semibold">
                      browse
                    </Text>
                  </div>
                </div>
              )}
            </Dropzone>
            <div className="flex w-full justify-center">
              <Label className="mt-1">OR</Label>
            </div>
            <div className="border min-h-32 justify-center border-dashed border-gray-200 flex flex-col items-center p-2 rounded-md">
              {blobUrl && (
                <div className="relative">
                  <Button
                    type="button"
                    size="extraSmall"
                    icon={BiTrash}
                    appearance="danger"
                    onClick={resetRecording}
                    className="absolute right-4 top-4 z-10"
                  >
                    Remove
                  </Button>
                  <video controls src={blobUrl} className="rounded-md w-full" />
                </div>
              )}
              {status === 'idle' && !blobUrl && (
                <Button
                  icon={BiVideoRecording}
                  appearance="primary"
                  type="button"
                  size="extraSmall"
                  onClick={startRecording}
                >
                  Record your screen
                </Button>
              )}

              {status === 'recording' && !blobUrl && (
                <Button
                  icon={BiVideoRecording}
                  appearance="danger"
                  type="button"
                  size="extraSmall"
                  onClick={stopRecording}
                >
                  Stop recording
                </Button>
              )}
            </div>
            <div className="flex w-full justify-center">
              <Label className="mt-1">OR</Label>
            </div>
            <div>
              <TextField
                onChange={handleChange}
                name="url"
                value={values.url}
                type="text"
                placeholder="Link"
                disabled={!!blob}
              />
            </div>

            <div className="mt-8 flex items-center justify-end">
              <Button
                icon={BiSave}
                type="button"
                appearance="primary"
                size="small"
                disabled={!blob && !isValid}
                onClick={() => {
                  if (blob) handleFileSubmit(blob, 'webm')
                  else handleSubmit()
                }}
                loading={loading}
              >
                {loading ? 'Uploading...' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-4 my-2">
          <div className="flex items-center justify-between">
            <Heading fontSize="medium">Clip and crop your video</Heading>
          </div>
          <div className="flex flex-col mt-4">
            {url && (
              <VideoEditor
                handleAction={(transformations) => {
                  handleAddVideo?.(url, transformations)
                  setView('fileSource')
                }}
                url={url}
                width={480}
                action="Save"
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default VideoModal
