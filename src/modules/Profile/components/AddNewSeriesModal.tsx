import { css, cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { toast } from 'react-toastify'

import { Button, emitToast, ScreenState, TextField } from '../../../components'
import { useUploadFile } from '../../../hooks/use-upload-file'
import { useCreateUserSeriesMutation } from '../../../generated/graphql'
import { Text } from '../../../components'

interface SeriesDetails {
  name: string
  pic: string
}
interface AddFlick {
  open: boolean
  seriesId: string
}

const AddNewSeriesModal = ({
  open,
  handleClose,
  setAddFlickSeriesModal,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
  setAddFlickSeriesModal: React.Dispatch<React.SetStateAction<AddFlick>>
}) => {
  const [createSeriesMutation, { data, loading, error }] =
    useCreateUserSeriesMutation()
  const [details, setDetails] = useState<SeriesDetails>({ name: '', pic: '' })
  const [loadingAssets, setLoadingAssets] = useState<boolean>(false)

  const [uploadFile] = useUploadFile()

  const handleClick = async (file: File | Blob) => {
    if (!file) return

    setLoadingAssets(true)
    const pic = await uploadFile({
      extension: file.name.split('.')[1],
      file,
    })
    setLoadingAssets(false)
    setDetails({ ...details, pic: pic.url })
  }

  useEffect(() => {
    setDetails({ name: '', pic: '' })
    if (data && data.CreateSeries) {
      emitToast({
        title: 'Success',
        autoClose: false,
        description: '🥳 Smile a little, because your Series is ready! 🥳',
        type: 'success',
      })

      setAddFlickSeriesModal({
        open: true,
        seriesId: data.CreateSeries.id,
      })
    }
  }, [data])

  const handleAddSeries = async () => {
    await createSeriesMutation({
      variables: {
        name: details.name,
        picture: details.pic,
      },
    })
  }

  if (loading) return <ScreenState title="Updating...." loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose(true)
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-1/2',
          css`
            background-color: #9ef7ff !important
            border: #02737d !important
      ;
          `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
    >
      <div className="w-100,h-100">
        <Text className="text-xl font-semibold mb-4"> Add Series! </Text>

        <TextField
          label="Name"
          type="text"
          className="px-3 py-3 mb-3 placeholder-blueGray-300 text-blueGray-600 relative border-2 border-blue-400  rounded text-lg shadow outline-none focus:outline-none focus:ring w-full"
          value={details.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setDetails({ ...details, name: e.target.value })
          }}
        />

        <TextField
          label="Description (optional)"
          type="text"
          className="px-3 py-3 placeholder-blueGray-300 text-blueGray-600 relative border-2 border-blue-400  rounded text-lg shadow outline-none focus:outline-none focus:ring w-full"
        />

        <input
          type="file"
          className=" px-1 py-3 text-blueGray-600 relative rounded text-lg w-full mt-8"
          accept="image/*"
          onChange={(e) => handleClick(e.target.files[0])}
        />
        <div className="flex flex-row gap-3">
          <Button
            appearance="primary"
            type="button"
            onClick={() => {
              handleClose(true)
              handleAddSeries()
            }}
            className="flex justify-end p-2 text-base bg-blue-400  text-white rounded-lg mt-4"
            disabled={loadingAssets}
            loading={loadingAssets}
          >
            Save
          </Button>

          <Button
            appearance="primary"
            type="button"
            className="flex justify-end text-base p-2 text-white rounded-lg bg-blue-400 mt-4"
            onClick={() => {
              handleClose(true)
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default AddNewSeriesModal
