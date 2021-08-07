import { css, cx } from '@emotion/css'
import 'react-responsive-modal/styles.css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { useSetRecoilState } from 'recoil'
import { useCreateSeriesMutation } from '../../../generated/graphql'
import { recoilState } from './UserSeries'
import { emitToast, TextField } from '../../../components'

interface SeriesDetails {
  name: string
}
interface AddFlick {
  open: boolean
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
  const setSeriesId = useSetRecoilState<number>(recoilState)

  useEffect(() => {
    setDetails({ name: '' })
    if (data && data.CreateSeries) {
      setSeriesId(data.CreateSeries.id)
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
        <text className="text-xl font-bold"> Add Series! </text>
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
              setAddFlickSeriesModal({
                open: true,
              })
            }}
          >
            Add
          </button>
          <button
            type="button"
            className="flex justify-end p-2 rounded-lg bg-pink-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default AddNewSeriesModal
