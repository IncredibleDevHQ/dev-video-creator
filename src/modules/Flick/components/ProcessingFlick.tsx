import React from 'react'
import { FiExternalLink } from 'react-icons/fi'
import { Heading, Text } from '../../../components'
import { ASSETS, LINKS } from '../../../constants'

const ProcessingFlick = ({ joinLink }: { joinLink: string }) => {
  return (
    <div className="flex w-full items-center justify-center min-h-screen flex-col">
      <img
        src={ASSETS.ICONS.PROCESSING}
        className="w-44 h-auto mb-16"
        alt="processing..."
      />
      <Heading fontSize="large" className="text-center">
        We are processing your video. <br />
        This could take a minute
      </Heading>
      <Text fontSize="small" className="my-2">
        Your flick will be available in this link once it’s done!
      </Text>
      <a
        href={LINKS.WATCH + joinLink}
        target="_blank"
        rel="noreferrer noopener"
        className="flex my-4 border p-2 rounded-md items-center justify-between"
      >
        {LINKS.WATCH + joinLink}
        <FiExternalLink size={24} className="mx-2" />
      </a>
    </div>
  )
}

export default ProcessingFlick
