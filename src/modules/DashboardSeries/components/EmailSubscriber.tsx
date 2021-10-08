import React, { useState } from 'react'
import { Button, emitToast, TextField } from '../../../components'
import {
  TargetTypes,
  useSubToVideoEmailsMutation,
} from '../../../generated/graphql'

const EmailSubscriber = ({
  sourceID,
  target,
  handleClose,
}: {
  sourceID: string
  target: TargetTypes
  handleClose?: (refresh?: boolean) => void
}) => {
  const [SubscribeToVideos, { data, loading, error }] =
    useSubToVideoEmailsMutation()
  const [emailSubscribe, setEmailSubscribe] = useState('')

  const handleClick = async () => {
    await SubscribeToVideos({
      variables: {
        email: emailSubscribe,
        sourceId: sourceID,
        targetType: target,
      },
    })

    emitToast({
      title: 'Success',
      description: 'Successfully subscribed !!!',
      type: 'success',
    })
  }

  return (
    <div className="flex flex-row space-x-5 ">
      <TextField
        className="text-justify"
        placeholder="Email Address"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setEmailSubscribe(e.target.value)
        }}
        value={emailSubscribe}
        label=""
      />
      <Button
        className="p-5"
        appearance="primary"
        type="button"
        size="small"
        onClick={(e) => {
          e?.preventDefault()
          handleClick()
          setEmailSubscribe('')
          if (!handleClose) return
          handleClose(true)
        }}
        loading={loading}
      >
        Subscribe
      </Button>
    </div>
  )
}

export default EmailSubscriber
