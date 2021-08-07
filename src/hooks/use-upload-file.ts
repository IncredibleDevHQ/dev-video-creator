import { nanoid } from 'nanoid'
import axios from 'axios'
import * as Sentry from '@sentry/react'
import mime from 'mime'
import { emitToast } from '../components/Toast'
import { useUploadFileMutation } from '../generated/graphql'

type AllowedFileExtensions =
  | 'png'
  | 'jpg'
  | 'svg'
  | 'jpeg'
  | 'webp'
  | 'webm'
  | 'mp4'
  | 'ts'
  | 'm3u8'
  | 'json'
  | 'yaml'

interface UploadFileProps {
  extension: AllowedFileExtensions
  file: Blob | File | Buffer
  handleProgress?: ({
    workDone,
    percentage,
  }: {
    workDone: number
    percentage: number
  }) => void
}

export const useUploadFile = () => {
  const [uploadFileMutation] = useUploadFileMutation()

  const uploadFile = async ({
    extension,
    file,
    handleProgress,
  }: UploadFileProps) => {
    try {
      const key = `${nanoid()}.${extension}`
      const { data, errors } = await uploadFileMutation({ variables: { key } })
      if (errors) {
        throw errors[0]
      }

      const url = data?.UploadFile?.url

      if (!url) {
        throw Error('The server did not return an upload URL.')
      }

      await axios({
        url,
        method: 'put',
        data: file,
        headers: {
          'Content-Type': mime.getType(extension),
          'content-disposition': 'attachment',
        },
        onUploadProgress: (e) => {
          const work = e.loaded / e.total
          handleProgress?.({
            workDone: work,
            percentage: Math.round(work * 100),
          })
        },
      })

      return { url, uuid: key }
    } catch (e) {
      emitToast({
        title: 'That upload failed.',
        description:
          e.message || 'That upload failed. Please try again in a while.',
        type: 'error',
      })

      Sentry.captureException(e)

      throw e
    }
  }

  return [uploadFile]
}
