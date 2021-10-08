import React, { useEffect, useState } from 'react'
import { BsChevronRight } from 'react-icons/bs'
import { Link, useParams } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import {
  Button,
  EmptyState,
  Heading,
  Navbar,
  ScreenState,
  Text,
} from '../../components'
import {
  Flick_Scope_Enum_Enum,
  TargetTypes,
  useGetSingleSeriesLazyQuery,
  useUpdateSeriesMutation,
} from '../../generated/graphql'
import { Auth, authState } from '../../stores/auth.store'
import { User, userState } from '../../stores/user.store'
import NewFlickBanner from '../Dashboard/components/NewFlickBanner'
import { Collaborators, EmailSubscriber, SubscribeModal } from './components'
import AddFlicksToSeriesModal from './components/AddFlicksToSeriesModal'
import FlicksView from './components/FlicksView'

const SingleSeries = () => {
  const [open, setOpen] = useState(false)
  const [flicksAdded, setFlicksAdded] = useState<boolean>(false)
  const params: { id?: string } = useParams()
  const [editSeriesName, setEditSeriesName] = useState(false)
  const userdata = (useRecoilValue(userState) as User) || {}
  const { isAuthenticated } = (useRecoilValue(authState) as Auth) || {}
  const [updateSeriesMutation, { data: updateSeriesNameData }] =
    useUpdateSeriesMutation()

  const [GetSingleSeries, { data, loading, error, refetch }] =
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

  const publishedFlicks = data?.Series_by_pk?.Flick_Series.filter(
    (flick) => flick.flick && flick.flick.producedLink
  )
  // Filters and collects uniques participants from flicks that are produced for Series Public Page
  const uniqueNames = Array.from(
    new Set(
      publishedFlicks
        ?.map((flicks) =>
          flicks.flick?.participants.map((userDetails) => [
            userDetails.user.displayName as string,
            userDetails.user.sub as string,
            userDetails.user.picture as string,
          ])
        )
        .flat()
        .flat()
    )
  )

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
      {isAuthenticated ? (
        // Check for authentication, on false opens up Series Public Page
        <div>
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
        </div>
      ) : (
        <div className="relative flex flex-col gap-2 ml-28 mr-28 mt-10">
          <div className="flex flex-col">
            <Heading className="text-lg capitalize w-36 h-10 ml-3 p-2 pb-16  truncate overflow-ellipsis">
              {data?.Series_by_pk?.name}
            </Heading>
            {!data && (
              <EmptyState text="You don't have any series" width={400} />
            )}

            <FlicksView />
          </div>
          <div className="flex flex-col ml-auto px-2 gap-y-5 absolute right-10 top-10">
            <EmailSubscriber
              sourceID={data?.Series_by_pk?.id}
              target={TargetTypes.SeriesSubsciption}
            />
            <div className="flex flex-col">
              <Heading className="text-lg md:capitalize  pl-1 mt-5">
                Collaborators
              </Heading>
            </div>
            <div className="flex flex-col">
              <Collaborators uniqueDetails={uniqueNames} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SingleSeries
