import React, { useEffect, useState } from 'react'
import { BsChevronRight } from 'react-icons/bs'
import { IoCheckmarkDone } from 'react-icons/io5'
import { useParams } from 'react-router-dom'
import {
  Button,
  EmptyState,
  Heading,
  ScreenState,
  Text,
} from '../../components'
import { ASSETS } from '../../constants'
import {
  useGetSingleSeriesLazyQuery,
  useSeriesFlicksQuery,
} from '../../generated/graphql'
import NewFlickBanner from '../Dashboard/components/NewFlickBanner'
import AddFlicksToSeriesModal from '../Series/components/AddFlicksToSeriesModal'

const SingleSeries = () => {
  const [open, setOpen] = useState(false)
  const [flicksAdded, setFlicksAdded] = useState<boolean>(false)
  const params: { id?: string } = useParams()

  const [GetSingleSeries, { data, loading, error }] =
    useGetSingleSeriesLazyQuery()

  const {
    data: flickData,
    loading: flickLoading,
    error: flickError,
  } = useSeriesFlicksQuery({
    variables: {
      id: params.id,
    },
  })

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
      <div className="relative flex flex-col gap-2 ml-28 mr-28">
        <div className="flex flex-row">
          <Text className="pt-2 mr-3 text-gray-500">Series</Text>
          <BsChevronRight className="mt-3" />
          <Heading className="text-lg capitalize w-36 h-10 ml-3 bg-gray-100 p-2">
            {data?.Series_by_pk?.name}
          </Heading>

          <div className="flex flex-row ml-auto px-2 items-center gap-x-3 justify-center">
            <NewFlickBanner />
            <Button
              type="button"
              appearance="secondary"
              size="small"
              className="text-white mt-5"
              onClick={() => setOpen(true)}
            >
              Add Series
            </Button>
          </div>
        </div>

        <Heading className="text-xl mb-10 font-bold">Flicks</Heading>
        <div className=" w-full gap-4">
          {!flickData && (
            <EmptyState text="You don't have any series" width={400} />
          )}
          {flickData?.Flick_Series.map((flick) => (
            <div
              key={flick.flick?.id}
              className="flex flex-col h-48 w-2/5 bg-white"
            >
              <div className="max-h-48 flex flex-row">
                <img
                  src="https://cdn.educba.com/academy/wp-content/uploads/2019/05/What-is-Coding.jpg"
                  alt="https://cdn.educba.com/academy/wp-content/uploads/2019/05/What-is-Coding.jpg"
                  className="w-80 h-48"
                />

                <div className="flex flex-col">
                  <div className="bg-green-300 h-5 w-24 ml-4 flex flex-row-1 items-center justify-center">
                    <IoCheckmarkDone size={15} />
                    <Text className="text-green-700 text-sm pl-2">
                      Published
                    </Text>
                  </div>

                  <Heading className="text-lg md:capitalize text-gray-600 font-bold pl-4 mt-5">
                    {flick.flick?.name}
                  </Heading>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-gray-100 h-0.5 w-3/6 mt-7" />
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
