import React, { useEffect, useState } from 'react'
import Gravatar from 'react-gravatar'
import { useParams } from 'react-router-dom'
import { Button, Heading, Navbar, ScreenState, Text } from '../../components'
import { ASSETS } from '../../constants'
import { useGetSingleSeriesLazyQuery } from '../../generated/graphql'
import NewFlickBanner from '../Dashboard/components/NewFlickBanner'
import AddFlicksToSeriesModal from '../Series/components/AddFlicksToSeriesModal'

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
      <img
        src={ASSETS.ICONS.IncredibleLogo}
        alt=""
        className="w-36 h-10 m-2 p-0"
      />
      <div className="relative m-4 flex flex-col gap-2">
        <div className="flex flex-col justify-evenly ml-2">
          <Heading className="text-2xl font-bold capitalize">
            {data?.Series_by_pk?.name}
          </Heading>
          <Text className="text-xs">{data?.Series_by_pk?.description}</Text>
        </div>

        <div className="flex flex-row gap-3">
          <NewFlickBanner />
          <Button
            appearance="primary"
            type="button"
            size="small"
            className="my-5 p-2 mx-2 flex justify-end text-white rounded-md"
            onClick={
              // history.push(
              //   `/new-flick?seriesid=${data?.Series_by_pk?.id}&seriesname=${data?.Series_by_pk?.name}`
              // )
              () => setOpen(true)
            }
          >
            Add existing flick
          </Button>
        </div>

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
