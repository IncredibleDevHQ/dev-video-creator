import { css, cx } from '@emotion/css'
import 'react-responsive-modal/styles.css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { useRecoilState } from 'recoil'
import { toast } from 'react-toastify'
import { useCreateSeriesMutation } from '../../../generated/graphql'

import { emitToast, TextField } from '../../../components'

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
            background-color: #ff99ab !important;
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
        <p className="text-xl font-bold"> Add Series! </p>
        <TextField
          label="Name"
          type="text"
          className="my-2"
          value={details.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setDetails({ name: e.target.value })
          }}
        />
        <TextField label="Description" type="text" className="my-2" />
        <div className="flex flex-row gap-3">
          <button
            type="button"
            className="flex justify-end p-2 bg-pink-800 rounded-lg"
            onClick={() => {
              handleClose(true)
              handleAddSeries()
            }}
          >
            Add
          </button>
          <button
            type="button"
            className="flex justify-end p-2 rounded-lg bg-pink-800"
            onClick={() => {
              handleClose(true)
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default AddNewSeriesModal
