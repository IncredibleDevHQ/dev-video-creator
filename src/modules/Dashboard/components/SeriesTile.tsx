import { css, cx } from '@emotion/css'
import { format } from 'date-fns'
import React from 'react'
import config from '../../../config'
import { DashboardSeriesFragment } from '../../../generated/graphql'

const clamp = css`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const SeriesTile = ({ series }: { series: DashboardSeriesFragment }) => {
  return (
    <a
      type="button"
      className="aspect-w-10 aspect-h-6 cursor-pointer"
      href={`${config.auth.endpoint}/series/${series.name}--${series.id}`}
      target="_blank"
      rel="noreferrer noopener"
    >
      <div className="flex flex-col border border-dark-200 rounded-lg p-6 h-full w-full hover:border-brand text-left">
        <span
          className={cx(
            'text-gray-100 font-main font-semibold text-base w-full',
            clamp
          )}
        >
          {series.name}
        </span>
        <time className="font-body text-dark-title text-xs mt-auto">
          Created on {format(new Date(series.createdAt), 'do MMMM yyyy')}
        </time>
      </div>
    </a>
  )
}

export default SeriesTile
