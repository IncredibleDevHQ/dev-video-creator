import React from 'react'
import { Modal } from 'react-responsive-modal'
import { Link } from 'react-router-dom'
import { Button, Heading } from '../../../components'
import { BaseFlickFragment } from '../../../generated/graphql'
import Video from '../../../components/Video'
import config from '../../../config'

const DashboardModal = ({
  flick,
  open,
  handleClose,
}: {
  flick: BaseFlickFragment
  open: boolean
  handleClose: (refresh?: boolean) => void
}) => {
  const { baseUrl } = config.storage

  return (
    <Modal
      classNames={{
        modal: 'w-full ',
        closeButton: 'focus:outline-none',
      }}
      styles={{
        modal: {
          maxWidth: '60%',
          maxHeight: '90%',
        },
      }}
      open={open}
      onClose={() => {
        handleClose(false)
      }}
      center
    >
      <div className="mx-4 mt-2">
        <div className="flex items-center justify-between">
          <Heading fontSize="medium">{flick.name}</Heading>
        </div>
        <Heading
          fontSize="small"
          className="h-8 my-1 overflow-hidden overflow-ellipsis"
        >
          {flick.description}
        </Heading>
      </div>
      <Video
        className="rounded-t-md w-full"
        src={baseUrl + flick.producedLink}
      />

      <Link to={`/flick/${flick.id}`}>
        <Button
          type="button"
          appearance="primary"
          className="border-white h-auto m-5 bg-gray-100 text-black float-right "
          size="medium"
        >
          Go to Studio
        </Button>
      </Link>
    </Modal>
  )
}

export default DashboardModal
