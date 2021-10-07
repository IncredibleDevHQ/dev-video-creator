import React, { useState } from 'react'
import { Button, TextField } from '../../../components'
import {
  TargetTypes,
  useSubToVideoEmailsMutation,
} from '../../../generated/graphql'

const EmailSubscriber = ({
  state,
  sourceID,
  target,
}: {
  state: boolean
  sourceID: string
  target: TargetTypes
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
  }

  return (
    <div className="flex flex-row space-x-5 ">
      <TextField
        className="text-justify"
        placeholder="Email Address"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setEmailSubscribe(e.target.value)
        }}
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
          javascript: eraseText()
        }}
        loading={loading}
      >
        Subscribe
      </Button>
    </div>
  )
}

export default EmailSubscriber
