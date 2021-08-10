import { css, cx } from '@emotion/css'
import 'react-responsive-modal/styles.css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { toast } from 'react-toastify'

import { Button, emitToast, TextField } from '../../../components'
import { useUploadFile } from '../../../hooks/use-upload-file'
import { useCreateSeriesMutation } from '../../../generated/graphql'

interface SeriesDetails {
  name: string
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
  const [createSeriesMutation, { data }] = useCreateSeriesMutation()
  const [details, setDetails] = useState<SeriesDetails>({ name: '' })
  const [pic, setPic] = useState<string>()
  const [loadingPic, setLoadingPic] = useState<boolean>(false)

  const [uploadFile] = useUploadFile()

  const handleClick = async (file: File | Blob) => {
    if (!file) return

    setLoadingPic(true)
    const pic = await uploadFile({
      extension: file.name.split('.')[1],
      file,
    })
    setLoadingPic(false)
    setPic(pic.url)
  }

  useEffect(() => {
    setDetails({ name: '' })
    if (data && data.CreateSeries) {
      toast('🥳 Smile a little, because your Series is ready! 🥳', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        className: css({
          background: '#ffe2eb !important',
        }),
      })
      setAddFlickSeriesModal({
        open: true,
        seriesId: data.CreateSeries.id,
      })
    }
  }, [data])

  const handleAddSeries = async () => {
    try {
      await createSeriesMutation({
        variables: {
          name: details.name,
          picture: pic,
        },
      })
    } catch (error: any) {
      emitToast({
        title: "We couldn't add your series",
        autoClose: false,
        type: 'error',
        description: `Click this toast to refresh and give it another try. (${error.code})`,
        onClick: () => window.location.reload(),
      })
    }
  }
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
        <p className="text-xl font-semibold mb-4"> Add Series! </p>
        <p className="m-2">Name</p>
        <input
          type="text"
          className="px-3 py-3 mb-3 placeholder-blueGray-300 text-blueGray-600 relative border-2 border-blue-400  rounded text-lg shadow outline-none focus:outline-none focus:ring w-full"
          value={details.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setDetails({ name: e.target.value })
          }}
        />

        <p className="mb-2 ml-2">Description (optional)</p>
        <input
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
            disabled={loadingPic}
            loading={loadingPic}
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
