import React, { useEffect } from 'react'
import Modal from 'react-responsive-modal'
import { useRecoilState, useRecoilValue } from 'recoil'
import 'react-responsive-modal/styles.css'
import { css, cx } from '@emotion/css'
import 'react-toastify/dist/ReactToastify.css'
import { useUpdateSeriesFlickMutation } from '../../../generated/graphql'
import {
  SeriesFlicks,
  FlicksList,
  FlicksTypes,
  recoilFlicksArray,
  recoilSeriesFlicksArray,
  SelectedFlicksList,
  SeriesFlicksTypes,
} from '../../DataStructure'

const AddFlicksToSeriesModal = ({
  open,
  handleClose,
  seriesId,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
  seriesId: string
}) => {
  const newSeriesId = seriesId
  const [addFlickToSeries] = useUpdateSeriesFlickMutation()
  const FlickList = useRecoilValue<FlicksList>(recoilFlicksArray)
  const [SeriesFlickList, setSeriesFlickList] =
    useRecoilState<SelectedFlicksList>(recoilSeriesFlicksArray)

  useEffect(() => {
    if (FlickList.userFlicksList.length > 0) {
      let list: SeriesFlicksTypes = []
      FlickList.userFlicksList.forEach((flick) => {
        const flickItem: SeriesFlicks = {
          id: flick.id,
          name: flick.name,
          isChecked: false,
        }
        list = [...list, flickItem]
      })
      setSeriesFlickList({ seriesFlicksList: list })
    }
  }, [FlickList])

  const reverseChecked = (id: SeriesFlicks['id']) => {
    const updatedList: SeriesFlicksTypes = SeriesFlickList.seriesFlicksList.map(
      (flick) => {
        if (flick.id === id) {
          return { ...flick, isChecked: !flick.isChecked }
        }
        return flick
      }
    )
    setSeriesFlickList({ seriesFlicksList: updatedList })
  }

  const SelectedFlicks = (): string[] => {
    const flick: FlicksTypes = SeriesFlickList.seriesFlicksList.filter(
      (t: SeriesFlicks): boolean => t.isChecked !== false
    )
    return flick.map((id) => id.id)
  }

  const FlicksInSeries = async () => {
    await addFlickToSeries({
      variables: {
        flickIds: SelectedFlicks(),
        seriesId: newSeriesId,
      },
    })
    if (!Error) {
      handleClose(true)
    }
    handleClose(true)
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
          {SeriesFlickList.seriesFlicksList.map((flick) => (
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
            Save
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

export default AddFlicksToSeriesModal
