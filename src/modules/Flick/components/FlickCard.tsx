import React from 'react'
import { useHistory } from 'react-router-dom'
import { Heading } from '../../../components'
import { BaseFlickFragment } from '../../../generated/graphql'

const FlickCard = ({
  flick,
  onClick,
  selected,
}: {
  flick: BaseFlickFragment
  onClick?: React.MouseEventHandler<HTMLDivElement>
  selected?: boolean
}) => {
  const history = useHistory()

  return (
    <div
      role="link"
      onKeyUp={() => {}}
      tabIndex={flick.id}
      onClick={onClick || (() => history.push(`/flick/${flick.id}`))}
      className={`border-brand border-2 rounded-md cursor-pointer w-48 h-9 pl-3 pt-1 hover:border-brand ${
        selected && 'border-brand border-l-4'
      }`}
    >
      <Heading className="text-sm w-44 truncate overflow-ellipsis capitalize">
        {flick.name}
      </Heading>
    </div>
  )
}

FlickCard.defaultProps = {
  onClick: {},
  selected: false,
}

export default FlickCard