import React from 'react'
import { useHistory } from 'react-router-dom'
import { Heading, Text } from '../../../components'
import { BaseFlickFragment } from '../../../generated/graphql'
import { formatDate } from '../../../utils/FormatDate'

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
      className={`bg-background-alt shadow-md p-4 rounded-md cursor-pointer border-l-2 hover:border-brand ${
        selected && 'border-brand border-l-4'
      }`}
    >
      <Heading fontSize="medium" className="text-xl">
        {flick.name}
      </Heading>
      <Text className="h-20 text-sm overflow-hidden overflow-ellipsis">
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Ullam maxime
        dolor voluptate, nam ab eaque corporis esse temporibus officiis
        consectetur odio est error doloribus et asperiores maiores veritatis
        autem neque.
      </Text>
      <div className="flex mt-2">
        <Text fontSize="small">{formatDate(new Date(flick.startAt))}</Text>
      </div>
    </div>
  )
}

FlickCard.defaultProps = {
  onClick: {},
  selected: false,
}

export default FlickCard
