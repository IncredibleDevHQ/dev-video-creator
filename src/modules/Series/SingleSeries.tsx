import React from 'react'
import { useHistory, useParams } from 'react-router-dom'
import { Button, Navbar, ScreenState } from '../../components'
import { useGetSingleSeriesQuery } from '../../generated/graphql'

const SingleSeries = () => {
  const params: { id?: string } = useParams()

  const { data, loading, error } = useGetSingleSeriesQuery({
    variables: {
      id: params.id,
    },
  })

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  console.log(data?.Series_by_pk)

  const history = useHistory()

  return (
    <>
      <Navbar />
      <div className="relative m-4 flex flex-col gap-2">
        <div className="flex p-4 gap-5 bg-red-50 rounded-md">
          <img
            className="rounded-md max-h-28"
            src={data?.Series_by_pk?.picture}
            alt={data?.Series_by_pk?.name}
          />
          <div className="flex flex-col justify-evenly">
            <h1 className="text-5xl font-bold">{data?.Series_by_pk?.name}</h1>
            <span className="text-lg">{data?.Series_by_pk?.description}</span>
          </div>
        </div>
        <Button
          appearance="primary"
          type="button"
          size="small"
          onClick={() =>
            history.push(
              `/new-flick?seriesid=${data?.Series_by_pk?.id}&seriesname=${data?.Series_by_pk?.name}`
            )
          }
        >
          Create New Flick
        </Button>
        <div className="p-4 bg-red-50 rounded-md">
          <h3 className="text-3xl">Flicks</h3>
          <div>flicks</div>
        </div>
      </div>
    </>
  )
}

export default SingleSeries
