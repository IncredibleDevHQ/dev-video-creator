import React from 'react'
import { EmptyState } from '../../../components'
import { FlickFragmentFragment } from '../../../generated/graphql'

const FragmentConfiguration = ({
  fragment,
}: {
  fragment: FlickFragmentFragment | undefined
}) => {
  if (!fragment) return <EmptyState text="No fragment Selected" width={400} />
  return <div className="h-96">{fragment.name}</div>
}

export default FragmentConfiguration
