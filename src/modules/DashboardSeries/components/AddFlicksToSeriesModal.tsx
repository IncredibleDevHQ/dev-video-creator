import { User } from '@sentry/react'
import React, { useState } from 'react'
import Modal from 'react-responsive-modal'
import { useRecoilValue } from 'recoil'
import { Button, ScreenState } from '../../../components'
import {
  useGetUserPublicFlicksQuery,
  useUpdateSeriesFlickMutation,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'
import { FlickCard } from '../../Flick/components'

const AddFlicksToSeriesModal = ({
  open,
  setOpen,
  seriesId,
  seriesName,
  setFlicksAdded,
  flicksAdded,
  flicks,
}: {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  seriesId: string
  seriesName?: string
  setFlicksAdded: React.Dispatch<React.SetStateAction<boolean>>
  flicksAdded: boolean
  flicks: string[]
}) => {
  const [selectedFlicks, setSelectedFlicks] = useState<string[]>(flicks)
  const { sub } = (useRecoilValue(userState) as User) || {}
  const { data, loading, error } = useGetUserPublicFlicksQuery({
    variables: { userId: sub || '' },
  })

  const [addFlickToSeries, { loading: loadingUser, error: errorUser }] =
    useUpdateSeriesFlickMutation()

  const flicksInSeries = async () => {
    await addFlickToSeries({
      variables: {
        flickIds: selectedFlicks,
        seriesId,
      },
    })

    setOpen(false)
    setFlicksAdded(!flicksAdded)
  }

  if (errorUser || error)
    return (
      <ScreenState
        title="Something went wrong!!"
        subtitle={errorUser?.message || error?.message}
      />
    )

  if (loading) return <ScreenState title="Just a jiffy..." loading />

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
      onClose={() => setOpen(false)}
      center
    >
      <div className="text-center pb-2 text-lg">
        Click on a Flick to Add to &quot;{seriesName}&quot;
      </div>
      <div className="grid grid-cols-3 gap-y-3 mt-5">
        {data?.Flick.map((flick) => (
          <FlickCard
            selected={selectedFlicks?.includes(flick.id)}
            flick={flick}
            key={flick.id}
            onClick={() => {
              if (!selectedFlicks?.includes(flick.id))
                setSelectedFlicks([...selectedFlicks, flick.id])
              else
                setSelectedFlicks(selectedFlicks.filter((f) => f !== flick.id))
            }}
          />
        ))}
      </div>
      <Button
        loading={loadingUser}
        className="mt-3"
        appearance="primary"
        type="button"
        onClick={flicksInSeries}
      >
        Add Flicks
      </Button>
    </Modal>
  )
}

AddFlicksToSeriesModal.defaultProps = {
  seriesName: undefined,
}

export default AddFlicksToSeriesModal
