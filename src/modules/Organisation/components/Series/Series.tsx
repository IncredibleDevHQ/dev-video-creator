/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useEffect, useState } from 'react'
import { Button } from '../../../../components'
import {
  SeriesFragment,
  useGetSeriesQuery,
} from '../../../../generated/graphql'

const Series = ({ organisationSlug }: { organisationSlug: string }) => {
  const [series, setSeries] = useState<SeriesFragment[]>()

  const {
    data,
    error: errorSeries,
    loading: loadingSeries,
  } = useGetSeriesQuery({
    variables: {
      organisationSlug,
    },
  })

  useEffect(() => {
    setSeries(data?.Series)
  }, [data])

  if (loadingSeries) {
    return <div className="text-xl">Loading...</div>
  }

  if (errorSeries) {
    return <div className="text-xl">Error Loading Series</div>
  }

  return (
    <div>
      <div className="w-1/3 flex m-1 mt-0 gap-2">
        <Button appearance="primary" type="button" size="small">
          Create Series
        </Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 grid-cols-1">
        {series?.map((series: SeriesFragment) => (
          <div
            key={series.id}
            className="flex cursor-pointer hover:bg-blue-200 items-center justify-between bg-blue-100 p-3 rounded-md m-1"
          >
            <div className="flex gap-5">
              <img
                className="rounded-md max-h-20"
                src={series.picture!}
                alt={series.name!}
              />
              <div className="flex flex-col justify-around">
                <span>{series.name}</span>
                <span>{series.description}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Series
