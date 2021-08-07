import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { useRecoilValue } from 'recoil'
import 'react-responsive-modal/styles.css'
import { css, cx } from '@emotion/css'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
  useGetMyFlicksQuery,
  useUpdateSeriesFlickMutation,
} from '../../../generated/graphql'
import { recoilState } from './UserSeries'

interface Flicks {
  id: string
  name: string
  isChecked: boolean
}

type FlicksTypes = Flicks[]
interface SelectedFlicksList {
  flicksList: FlicksTypes
}

const AddFlicksToSeriesModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
}) => {
  const { data } = useGetMyFlicksQuery({
    variables: {
      limit: 60,
    },
  })

  const [flicks, setFlick] = useState<SelectedFlicksList>({ flicksList: [] })
  const [addFlickToSeries, { data: success }] = useUpdateSeriesFlickMutation()
  const seriesId = useRecoilValue<string>(recoilState)

  useEffect(() => {
    if (data && data?.Flick.length > 0) {
      let list: FlicksTypes = []
      data.Flick.forEach((flick) => {
        const flickItem: Flicks = {
          id: flick.id,
          name: flick.name,
          isChecked: false,
        }
        list = [...list, flickItem]
      })
      setFlick({ flicksList: list })
    }
  }, [data])

  useEffect(() => {
    handleClose(true)
    if (
      success &&
      success.UpdateSeriesFlicks &&
      success.UpdateSeriesFlicks.success
    ) {
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
    }
  }, [success])

  const reverseChecked = (id: Flicks['id']) => {
    const updatedList: FlicksTypes = flicks.flicksList.map((flick) => {
      if (flick.id === id) {
        return { ...flick, isChecked: !flick.isChecked }
      }
      return flick
    })
    setFlick({ flicksList: updatedList })
  }

  const SelectedFlicks = (): string[] => {
    const flick: FlicksTypes = flicks.flicksList.filter(
      (t: Flicks): boolean => t.isChecked !== false
    )
    return flick.map((id) => id.id)
  }

  const FlicksInSeries = async () => {
    const newSeriesId = seriesId
    await addFlickToSeries({
      variables: {
        flickIds: SelectedFlicks(),
        seriesId: newSeriesId,
      },
    })
    if (!Error) {
      handleClose(true)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
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
        <p className="text-xl font-bold"> Add Flicks to Series! </p>

        <div className="p-4">
          {flicks.flicksList.map((flick) => (
            <div key={flick.id} className="flex items-center mr-4 mb-2">
              <input
                type="checkbox"
                id={flick.id}
                name={flick.name}
                value={flick.id}
                checked={flick.isChecked}
                onChange={() => reverseChecked(flick.id)}
              />
              <label htmlFor="click-yes" className="select-none">
                {flick.name}
              </label>
            </div>
          ))}
        </div>
        <div className="flex flex-row gap-3">
          <button
            onClick={FlicksInSeries}
            className="flex justify-end p-2 bg-pink-800 rounded-lg"
            type="button"
          >
            Add
          </button>
          <button
            type="button"
            className="flex justify-end p-2 rounded-lg bg-pink-800"
          >
            {' '}
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default AddFlicksToSeriesModal
