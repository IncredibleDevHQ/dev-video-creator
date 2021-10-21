import React, { useEffect, useState } from 'react'
import { AiOutlinePlus } from 'react-icons/ai'
import { BsChevronRight } from 'react-icons/bs'
import { Link, useHistory, useParams } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { Button, Heading, Navbar, ScreenState, Text } from '../../components'
import {
  Flick_Scope_Enum_Enum,
  useGetSingleSeriesQuery,
  useUpdateSeriesMutation,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import { Collaborators } from './components'
import AddFlicksToSeriesModal from './components/AddFlicksToSeriesModal'
import FlicksView from './components/FlicksView'

const SingleSeries = () => {
  const [open, setOpen] = useState(false)
  const [flicksAdded, setFlicksAdded] = useState<boolean>(false)
  const params: { id?: string } = useParams()
  const [editSeriesName, setEditSeriesName] = useState(false)
  const userdata = (useRecoilValue(userState) as User) || {}
  const history = useHistory()
  const [updateSeriesMutation, { data: updateSeriesNameData }] =
    useUpdateSeriesMutation()

  const { data, loading, error, refetch } = useGetSingleSeriesQuery({
    variables: {
      id: params.id,
    },
  })

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
    if (flicksAdded) refetch()
  }, [flicksAdded])

  const allCollaborators = Array.from(
    new Set(
      data?.Series_by_pk?.Flick_Series?.map((f) =>
        f.flick?.participants.map((userDetails) => [
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
    <div>
      <Navbar />
      <div className="grid grid-cols-12">
        <div className="col-start-2 col-end-9 flex flex-col gap-2 mt-10">
          <div className="flex flex-row items-center">
            <Link to="/dashboard">
              <Text className="text-gray-500 ">Series</Text>
            </Link>
            <BsChevronRight className="mx-4" />
            {data?.Series_by_pk?.ownerSub === userdata.sub ? (
              <Heading
                className="text-lg capitalize bg-gray-100 truncate overflow-ellipsis px-4 py-1 rounded-md"
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
              <Heading className="text-lg capitalize bg-gray-100 truncate overflow-ellipsis px-4 py-1 rounded-md">
                {data?.Series_by_pk?.name}
              </Heading>
            )}
          </div>
          <Heading className="text-xl mt-10 mb-10 font-bold">Flicks</Heading>
          <FlicksView />
        </div>
        <div className="col-span-3 mt-10">
          <div className="flex">
            <Button
              type="button"
              size="small"
              appearance="primary"
              className="py-2 px-3 mr-4"
              onClick={() => history.push(`/new-flick/${params.id}`)}
              icon={AiOutlinePlus}
            >
              Create flick
            </Button>
            <Button
              type="button"
              appearance="secondary"
              size="small"
              className="py-2 px-3"
              onClick={() => setOpen(true)}
            >
              Add Flick
            </Button>
          </div>
          <div className="flex flex-col">
            <Heading className="text-lg md:capitalize font-bold pl-1 mt-10 mb-10">
              Collaborators
            </Heading>
            <Collaborators uniqueDetails={allCollaborators} />
          </div>
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
    </div>
  )
}

export default SingleSeries
