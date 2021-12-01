import React from 'react'
import { FiExternalLink, FiX } from 'react-icons/fi'
import { Confetti, Heading, Text } from '../../../components'
import { ASSETS, LINKS } from '../../../constants'

const ProcessingFlick = ({
  joinLink,
  publish,
  setProcessing,
}: {
  joinLink: string
  publish: boolean
  setProcessing: (processing: boolean) => void
}) => {
  return (
    <>
      <Confetti fire={publish} />
      <div className="flex w-full items-center justify-center min-h-screen flex-col relative">
        <FiX
          className="absolute right-4 top-4 cursor-pointer"
          size={32}
          onClick={() => setProcessing(false)}
        />
        <img
          src={ASSETS.ICONS.PROCESSING}
          className="h-48 w-auto"
          alt="processing..."
        />
        {publish ? (
          <Heading fontSize="large" className="text-center">
            Hurray!! Your Flick is now published.
          </Heading>
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
          href={LINKS.WATCH + joinLink}
          target="_blank"
          rel="noreferrer noopener"
          className="flex my-4 border p-2 rounded-md items-center justify-between"
        >
          {`${LINKS.WATCH}/watch/${joinLink}`}
          <FiExternalLink size={24} className="mx-2" />
        </a>
      </div>
    </>
  )
}

export default ProcessingFlick
