import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  useGetMyFlicksQuery,
  useSeriesFlicksQuery,
} from '../../generated/graphql'
import { AddFlicksToSeriesModal } from '../Profile/components'
import { Text, Heading, EmptyState, ScreenState } from '../../components'

import {
  recoilSeriesFlicksArray,
  SelectedFlicksList,
  SeriesFlicks,
  SeriesFlicksTypes,
} from '../../stores/series.store'
import { AddFlick } from '../Profile/components/UserSeries'

const UserSeriesFlicks = () => {
  const { id } = useParams<{ id: string }>()
  const [addFlickSeriesModal, setAddFlickSeriesModal] = useState<AddFlick>({
    open: false,
    seriesId: '',
  })

  const [SeriesFlickList, setSeriesFlickList] =
    useRecoilState<SelectedFlicksList>(recoilSeriesFlicksArray)
  const seriesId = id
  const { data, loading, error } = useSeriesFlicksQuery({
    variables: {
      id: seriesId,
    },
  })

  const { data: dataFlicks } = useGetMyFlicksQuery({
    variables: {
      limit: 30,
    },
  })

  useEffect(() => {
    let list: SeriesFlicksTypes = []
    if (dataFlicks && dataFlicks?.Flick.length > 0) {
      dataFlicks?.Flick.forEach((flick) => {
        const flickItem: SeriesFlicks = {
          id: flick?.id,
          name: flick?.name as string,
          description: flick?.description as string,
          isChecked: false,
        }
        if (data && data.Flick_Series.length > 0) {
          data.Flick_Series.forEach((selectedId) => {
            if (selectedId.flicks?.id === flickItem.id) {
              flickItem.isChecked = true
            }
          })
        }
        list = [...list, flickItem]
      })
    }
    setSeriesFlickList({ seriesFlicksList: list })
  }, [data, dataFlicks])
  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )
  return (
    <div className="  flex flex-col w-full">
      <div className="m-3 ml-8 p-2 rounded-lg border-blue-400 border-2 bg-white w-auto">
        <Text className="m-1 p-2  text-3xl text-black rounded-lg w-auto">
          Flicks
        </Text>
      </div>
      <button
        className="flex w-32 justify-center align-middle p-1 text-base m-2 ml-8 mb-5 cursor-pointer bg-blue-400 text-white bg-opacity-50 rounded-lg"
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
      <div className=" w-full grid grid-flow-row grid-cols-3 grid-rows-3 gap-4 ml-8">
        {!data && <EmptyState text="You don't have any series" width={400} />}
        {SeriesFlickList.seriesFlicksList.length > 0 &&
          SeriesFlickList.seriesFlicksList.map(
            (flick) =>
              flick.isChecked === true && (
                <div
                  key={flick.id}
                  className="flex flex-col h-80 md:max-h-80 rounded-lg ml-7 w-60 md:w-80 lg:w-80 m-2 border-blue-400 border-2 bg-white shadow-md"
                >
                  <div className="max-h-48">
                    <img
                      src="https://cdn.educba.com/academy/wp-content/uploads/2019/05/What-is-Coding.jpg"
                      alt="https://cdn.educba.com/academy/wp-content/uploads/2019/05/What-is-Coding.jpg"
                      className="max-h-48 w-80 rounded-md"
                    />
                    <Text className=" text-gray-600 flex justify-end  text-sm p-1">
                      ▪️12:38
                    </Text>
                  </div>
                  <Heading className="text-md md:capitalize text-gray-600 pl-4 font-bold ">
                    {flick.name}
                  </Heading>
                  <Heading className="text-md md:capitalize text-gray-600 pt-2 p-4 font-light ">
                    {flick.description}
                  </Heading>
                </div>
              )
          )}
      </div>
    </div>
  )
}

export default UserSeriesFlicks
