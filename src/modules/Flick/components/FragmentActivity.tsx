import React from 'react'
import { EmptyState } from '../../../components'
import Video from '../../../components/Video'
import config from '../../../config'
import { FlickFragmentFragment } from '../../../generated/graphql'

const FragmentActivity = ({
  fragment,
}: {
  fragment?: FlickFragmentFragment
}) => {
  if (!fragment) return <EmptyState text="No fragment Selected" width={400} />

  return (
    <div>
      {fragment.producedLink && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <Video
          className="rounded-t-md w-full"
          src={config.storage.baseUrl + fragment.producedLink}
        />
      )}
    </div>
  )
}

FragmentActivity.defaultProps = {
  fragment: undefined,
}

export default FragmentActivity
