import React, { useEffect } from 'react'
import Modal from 'react-responsive-modal'
import { useRecoilState } from 'recoil'
import { css, cx } from '@emotion/css'
import { Checkbox, ScreenState, Text } from '../../../components'

import {
  useGetMyFlicksQuery,
  useUpdateSeriesFlickMutation,
} from '../../../generated/graphql'
import {
  recoilSeriesFlicksArray,
  SelectedFlicksList,
  SeriesFlicks,
  SeriesFlicksTypes,
} from '../../../stores/series.store'

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
  const [seriesFlickList, setSeriesFlickList] =
    useRecoilState<SelectedFlicksList>(recoilSeriesFlicksArray)
  const { data, loading, error } = useGetMyFlicksQuery({
    variables: {
      limit: 30,
    },
  })

  useEffect(() => {
    if (data?.Flick.length) {
      let list: SeriesFlicksTypes = []
      data?.Flick.forEach((flick) => {
        const flickItem: SeriesFlicks = {
          id: flick.id,
          name: flick.name,
          description: flick.description as string,
          isChecked: false,
        }
        list = [...list, flickItem]
      })

      setSeriesFlickList({ seriesFlicksList: list })
    }
  }, [data])

  const reverseChecked = (id: SeriesFlicks['id']) => {
    const updatedList: SeriesFlicksTypes = seriesFlickList.seriesFlicksList.map(
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
    const flick: SeriesFlicksTypes = seriesFlickList.seriesFlicksList.filter(
      (t: SeriesFlicks): boolean => t.isChecked !== false
    )
    return flick.map((id) => id.id)
  }

  const flicksInSeries = async () => {
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

  if (loading) return <ScreenState title="Loading...." loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

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
      <div className="w-100,h-100">
        <Text className="text-xl font-semibold"> Add Flicks to Series! </Text>

        <div className="p-4">
          {seriesFlickList.seriesFlicksList.map((flick) => (
            <div key={flick.id} className="flex items-center mr-4 mb-2">
              <Checkbox
                id={flick.id}
                name={flick.name}
                value={flick.id}
                checked={flick.isChecked}
                onChange={() => reverseChecked(flick.id)}
                className="flex flex-wrap lg:align-middle gap-3 text-lg text-black ml-4 lg:capitalize"
                label={flick.name}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-row gap-3">
          <button
            onClick={flicksInSeries}
            className="flex justify-end p-2  bg-blue-400  text-white rounded-lg"
            type="button"
          >
            Save
          </button>
          <button
            type="button"
            className="flex justify-end p-2 text-white rounded-lg bg-blue-400"
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
