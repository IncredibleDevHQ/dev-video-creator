import React, { useEffect, useState } from 'react'
import { BsChevronRight } from 'react-icons/bs'
import { Link, useParams } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { Button, Heading, Navbar, ScreenState, Text } from '../../components'
import {
  Flick_Scope_Enum_Enum,
  useGetSingleSeriesLazyQuery,
  User,
  useUpdateSeriesMutation,
} from '../../generated/graphql'
import { userState } from '../../stores/user.store'
import NewFlickBanner from '../Dashboard/components/NewFlickBanner'
import AddFlicksToSeriesModal from './components/AddFlicksToSeriesModal'
import FlicksView from './components/FlicksView'

const SingleSeries = () => {
  const [open, setOpen] = useState(false)
  const [flicksAdded, setFlicksAdded] = useState<boolean>(false)
  const params: { id?: string } = useParams()
  const [editSeriesName, setEditSeriesName] = useState(false)
  const userdata = (useRecoilValue(userState) as User) || {}
  const [updateSeriesMutation, { data: updateSeriesNameData }] =
    useUpdateSeriesMutation()

  const [GetSingleSeries, { data, loading, error }] =
    useGetSingleSeriesLazyQuery()

  const updateSeriesMutationFunction = async (newName: string) => {
    if (editSeriesName) {
      await updateSeriesMutation({
        variables: {
          name: newName,
          seriesId: data?.Series_by_pk?.id,
        },
      })
    }
  }

  useEffect(() => {
    GetSingleSeries({
      variables: {
        id: params.id,
      },
    })
  }, [flicksAdded])

  useEffect(() => {
    if (!updateSeriesNameData) return
    setEditSeriesName(false)
  }, [updateSeriesNameData])

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <>
      <Navbar />
      <div className="relative flex flex-col gap-2 ml-28 mr-28 mt-10">
        <div className="flex flex-row">
          <Link to="/dashboard">
            <Text className="pt-2 mr-3 text-gray-500 ">Series</Text>
          </Link>
          <BsChevronRight className="mt-3" />
          {data?.Series_by_pk?.ownerSub === userdata.sub ? (
            <Heading
              className="text-lg capitalize w-36 h-10 ml-3 bg-gray-100 p-2 truncate overflow-ellipsis  cursor-auto hover:bg-gray-300 "
              contentEditable={editSeriesName}
              onClick={() => {
                setEditSeriesName(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  updateSeriesMutationFunction(e.currentTarget.innerText)
                }
              }}
            >
              {data?.Series_by_pk?.name}
            </Heading>
          ) : (
            <Heading className="text-lg capitalize w-36 h-10 ml-3 bg-gray-100 p-2 truncate overflow-ellipsis">
              {data?.Series_by_pk?.name}
            </Heading>
          )}

          {data?.Series_by_pk?.ownerSub === userdata.sub && (
            <div className="flex flex-row ml-auto px-2 items-center gap-x-3 justify-center">
              <NewFlickBanner seriesId={params.id} />
              <Button
                type="button"
                appearance="secondary"
                size="small"
                className="text-white mt-5"
                onClick={() => setOpen(true)}
              >
                Add Flick
              </Button>
            </div>
          )}
        </div>

        <Heading className="text-xl mb-10 font-bold">Flicks</Heading>

        <FlicksView />
      </div>
      <AddFlicksToSeriesModal
        setFlicksAdded={setFlicksAdded}
        open={open}
        setOpen={setOpen}
        seriesId={data?.Series_by_pk?.id}
        seriesName={data?.Series_by_pk?.name}
        flicksAdded={flicksAdded}
        flicks={
          data?.Series_by_pk?.Flick_Series.filter(
            (p) => p.flick?.scope === Flick_Scope_Enum_Enum.Public
          ).map((flick) => flick.flick?.id as string) || []
        }
      />
    </>
  )
}

export default SingleSeries
