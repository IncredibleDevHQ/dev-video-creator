import React, { useEffect, useState } from 'react'
import Gravatar from 'react-gravatar'
import { useParams } from 'react-router-dom'
import { Button, Heading, Navbar, ScreenState, Text } from '../../components'
import { useGetSingleSeriesLazyQuery } from '../../generated/graphql'
import AddFlicksToSeriesModal from './components/AddFlicksToSeriesModal'

const SingleSeries = () => {
  const [open, setOpen] = useState(false)
  const [flicksAdded, setFlicksAdded] = useState<boolean>(false)
  const params: { id?: string } = useParams()

  const [GetSingleSeries, { data, loading, error }] =
    useGetSingleSeriesLazyQuery()

  useEffect(() => {
    GetSingleSeries({
      variables: {
        id: params.id,
      },
    })
  }, [flicksAdded])

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <>
      <Navbar />
      <div className="relative m-4 flex flex-col gap-2">
        <div className="flex p-4 gap-5 bg-red-50 rounded-md">
          {data?.Series_by_pk?.picture ? (
            <img
              className="rounded-md max-h-28"
              src={data?.Series_by_pk?.picture}
              alt={data?.Series_by_pk?.name}
            />
          ) : (
            <Gravatar
              className="rounded-md h-28 w-28"
              email={data?.Series_by_pk?.name}
            />
          )}
          <div className="flex flex-col justify-evenly">
            <Heading className="text-5xl font-bold">
              {data?.Series_by_pk?.name}
            </Heading>
            <Text className="text-lg">{data?.Series_by_pk?.description}</Text>
          </div>
        </div>
        <Button
          appearance="primary"
          type="button"
          size="small"
          onClick={
            // history.push(
            //   `/new-flick?seriesid=${data?.Series_by_pk?.id}&seriesname=${data?.Series_by_pk?.name}`
            // )
            () => setOpen(true)
          }
        >
          Add Flick
        </Button>
        <div className="p-4 bg-red-50 rounded-md">
          <Heading className="text-3xl">Flicks</Heading>
          <div>flicks</div>
        </div>
      </div>
      <AddFlicksToSeriesModal
        setFlicksAdded={setFlicksAdded}
        open={open}
        setOpen={setOpen}
        seriesId={data?.Series_by_pk?.id}
        seriesName={data?.Series_by_pk?.name}
        flicksAdded={flicksAdded}
      />
    </>
  )
}

export default SingleSeries
