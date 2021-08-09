import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  FlicksList,
  recoilFlicksArray,
  recoilSeriesFlicksArray,
  SelectedFlicksList,
  SeriesFlicks,
  SeriesFlicksTypes,
} from '../DataStructure'
import { useSeriesFlicksQuery } from '../../generated/graphql'
import { AddFlicksToSeriesModal } from '../Profile/components'

interface AddFlick {
  open: boolean
  seriesId: string
}

const UserSeriesFlicks = () => {
  const { id } = useParams<{ id: string }>()
  const [addFlickSeriesModal, setAddFlickSeriesModal] = useState<AddFlick>({
    open: false,
    seriesId: '',
  })

  const userFlickList = useRecoilValue<FlicksList>(recoilFlicksArray)
  const [SeriesFlickList, setSeriesFlickList] =
    useRecoilState<SelectedFlicksList>(recoilSeriesFlicksArray)
  const seriesId = id
  const { data } = useSeriesFlicksQuery({
    variables: {
      id: seriesId,
    },
  })

  useEffect(() => {
    let list: SeriesFlicksTypes = []
    if (userFlickList.userFlicksList.length > 0) {
      userFlickList.userFlicksList.forEach((flick) => {
        const flickItem: SeriesFlicks = {
          id: flick?.id,
          name: flick.name as string,
          isChecked: false,
        }
        if (data && data.Flick_Series.length > 0) {
          data.Flick_Series.forEach((selectedId) => {
            if (selectedId.Series_Flicks?.id === flickItem.id) {
              flickItem.isChecked = true
            }
          })
        }
        list = [...list, flickItem]
      })
    }
    setSeriesFlickList({ seriesFlicksList: list })
  }, [data])

  return (
    <div className="  flex flex-col max-w-full">
      <p className="m-2 p-3 bg-pink-400 bg-opacity-25 text-3xl rounded-lg w-auto">
        Flicks
      </p>
      <button
        className="flex w-32 justify-center align-middle p-1 text-base m-2  cursor-pointer bg-pink-400 bg-opacity-50 rounded-lg"
        type="button"
        onClick={() => setAddFlickSeriesModal({ open: true, seriesId: id })}
      >
        Add Flicks
      </button>
      <AddFlicksToSeriesModal
        open={addFlickSeriesModal.open}
        seriesId={addFlickSeriesModal.seriesId}
        handleClose={() => {
          setAddFlickSeriesModal({ open: false, seriesId: id })
        }}
      />
      <div className=" max-w-full grid grid-flow-row grid-cols-3 grid-rows-3 gap-4">
        {SeriesFlickList.seriesFlicksList.length > 0 ? (
          SeriesFlickList.seriesFlicksList.map((flick) =>
            flick.isChecked === true ? (
              <div
                key={flick.id}
                className="p-8 m-2 bg-gradient-to-r from-pink-400 via-orange-500 to-red-500 rounded shadow-md"
              >
                <h2 className="text-base text-gray-700  ">{flick.name}</h2>
              </div>
            ) : null
          )
        ) : (
          <p className="max-w-full mt-4 text-lg flex justify-center align-middle">
            You dont have any Flicks in this series yet!
          </p>
        )}
      </div>
    </div>
  )
}

export default UserSeriesFlicks
