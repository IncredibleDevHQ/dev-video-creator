import React, { useEffect, useState } from 'react'
import { FiExternalLink, FiX } from 'react-icons/fi'
import config from '../../../config'
import { Confetti, Heading, Text } from '../../../components'
import { ASSETS } from '../../../constants'
import {
  Flick_Status_Enum_Enum,
  useFlickStatusSubscription,
} from '../../../generated/graphql'

const ProcessingFlick = ({
  flickId,
  joinLink,
  setProcessing,
}: {
  flickId: string
  joinLink: string
  setProcessing: (processing: boolean) => void
}) => {
  const [published, setPublished] = useState(false)
  const { publicUrl } = config.client

  const { data } = useFlickStatusSubscription({ variables: { flickId } })

  useEffect(() => {
    if (!published) return
    const timer = setTimeout(() => setPublished(() => false), 10000)

    // eslint-disable-next-line consistent-return
    return () => {
      clearTimeout(timer)
    }
  }, [published])

  useEffect(() => {
    if (data?.Flick_by_pk?.status !== Flick_Status_Enum_Enum.Completed) return
    setPublished(true)
  }, [data])

  return (
    <>
      <Confetti fire={published} />
      <div className="flex w-full items-center justify-center min-h-screen flex-col relative">
        <FiX
          className="absolute right-4 top-4 cursor-pointer"
          size={32}
          onClick={() => setProcessing(false)}
        />
        <img
          src={published ? ASSETS.ICONS.SUCCESS : ASSETS.ICONS.PROCESSING}
          className="h-48 w-auto"
          alt="processing..."
        />
        {published ? (
          <>
            <Heading fontSize="large" className="text-center">
              Hurrah!
            </Heading>
            <Text fontSize="small" className="my-2">
              Your Flick is now published.
            </Text>
          </>
        ) : (
          <>
            <Heading fontSize="large" className="text-center">
              We are processing your video. <br />
              This could take a minute
            </Heading>
            <Text fontSize="small" className="my-2">
              Your flick will be available in this link once it’s done!
            </Text>
          </>
        )}
        <a
          href={`${publicUrl}watch/${joinLink}`}
          target="_blank"
          rel="noreferrer noopener"
          className="flex my-4 border p-2 rounded-md items-center justify-between"
        >
          {`${publicUrl}watch/${joinLink}`}
          <FiExternalLink size={24} className="mx-2" />
        </a>
      </div>
    </>
  )
}

export default ProcessingFlick
