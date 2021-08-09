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
          description: flick.discription as string,
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
      <div className="m-3 ml-8 p-2 rounded-lg border-blue-400 border-2 bg-white w-auto">
        <p className="m-1 p-2  text-3xl text-black rounded-lg w-auto">Flicks</p>
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
      <div className=" max-w-full grid grid-flow-row grid-cols-3 grid-rows-3 gap-4 ml-8">
        {SeriesFlickList.seriesFlicksList.length > 0 ? (
          SeriesFlickList.seriesFlicksList.map((flick) =>
            flick.isChecked === true ? (
              <div
                key={flick.id}
                className="flex flex-col h-80 md:max-h-80 rounded-lg ml-7 w-60 md:w-80 lg:w-80 m-2 border-blue-400 border-2 bg-white shadow-md"
              >
                <div className="max-h-48">
                  <img
                    src="https://cdn.educba.com/academy/wp-content/uploads/2019/05/What-is-Coding.jpg"
                    className="max-h-48 w-80 rounded-md"
                    alt="https://www.google.com/url?sa=i&url=http%3A%2F%2Fwww.manuscriptorium.com%2Fapps%2Fgbank%2Fgbank_table.php&psig=AOvVaw0VwFCv74ldPzmrxJXJEJaV&ust=1628622050638000&source=images&cd=vfe&ved=0CAsQjRxqFwoTCMjLn4jQpPICFQAAAAAdAAAAABAI"
                  />
                  <p className=" text-gray-600 flex justify-end  text-sm p-1">
                    ▪️12:38
                  </p>
                </div>
                <h2 className="text-md md:capitalize text-gray-600 pl-4 font-bold ">
                  {flick.name}
                </h2>
                <h2 className="text-md md:capitalize text-gray-600 pt-2 p-4 font-light ">
                  {flick.description}
                </h2>
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
