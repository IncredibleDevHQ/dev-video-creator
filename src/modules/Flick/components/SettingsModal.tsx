import React, { useState } from 'react'
import { Modal } from 'react-responsive-modal'
import { cx, css } from '@emotion/css'
import { useRecoilState } from 'recoil'
import { BiTrash } from 'react-icons/bi'
import { newFlickStore } from '../store/flickNew.store'
import {
  dismissToast,
  emitToast,
  FileDropzone,
  Heading,
  Label,
} from '../../../components'
import { useUploadFile } from '../../../hooks'
import { AllowedFileExtensions } from '../../../hooks/use-upload-file'
import { useUpdateFlickThumbnailMutation } from '../../../generated/graphql'
import config from '../../../config'

const SettingsModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
}) => {
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)

  const [loading, setLoading] = useState(false)
  const [updateFlickThumbnail] = useUpdateFlickThumbnailMutation()

  const [uploadFile] = useUploadFile()

  const handleClearThumbnail = async () => {
    await updateFlickThumbnail({
      variables: { id: flick?.id, thumbnail: null },
    })

    // @ts-ignore
    setFlickStore((prev) => ({
      ...prev,
      flick: {
        ...prev.flick,
        thumbnail: null,
      },
    }))
  }

  const handleUploadThumbnail = async (file: File | null) => {
    if (!file) return
    setLoading(true)

    const toast = emitToast({
      title: 'Uploading thumbnail...',
      type: 'info',
      autoClose: false,
    })

    try {
      const { uuid } = await uploadFile({
        extension: file.name.split('.').pop() as AllowedFileExtensions,
        file,
      })

      await updateFlickThumbnail({
        variables: { id: flick?.id, thumbnail: uuid },
      })

      // @ts-ignore
      setFlickStore((prev) => ({
        ...prev,
        flick: {
          ...prev.flick,
          thumbnail: uuid,
        },
      }))

      dismissToast(toast)
      emitToast({
        title: 'Thumbnail was updated!',
        type: 'success',
      })
    } catch (e) {
      dismissToast(toast)
      emitToast({
        title: 'Something went wrong while updating the thumbnail.',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
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
      <div>
        <div className="mx-4 my-2">
          <div className="flex items-center justify-between">
            <Heading fontSize="medium">Settings</Heading>
          </div>

          {flick?.thumbnail ? (
            <div className="mt-4">
              <div className="flex items-center mb-2 justify-between">
                <Label>Thumbnail</Label>
                <BiTrash
                  onClick={() => handleClearThumbnail()}
                  className="text-red-600 cursor-pointer"
                />
              </div>
              <div className="flex justify-center">
                <img
                  src={config.storage.baseUrl + flick.thumbnail}
                  alt={flick.name}
                  className="w-full rounded-lg max-w-xs text-center"
                />
              </div>
            </div>
          ) : (
            <FileDropzone
              className="text-sm my-4 w-full border-brand border border-dashed justify-center p-2 flex items-center rounded-md"
              overrideClassNames
              onChange={(e: any) => {
                handleUploadThumbnail(e.target.files?.[0])
              }}
              text="Drag a thumbnail for this flick"
              disabled={loading}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}

export default SettingsModal
