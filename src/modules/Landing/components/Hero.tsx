import React from 'react'
import Lottie from 'react-lottie'
import { useHistory } from 'react-router-dom'
import { Navbar } from '.'
import { Button, Heading, Text } from '../../../components'
import { ASSETS } from '../../../constants'

const defaultOptions = {
  loop: true,
  autoplay: true,
  animationData: ASSETS.ANIMATION.LANDING_DEVELOPER,
  rendererSettings: {
    preserveAspectRatio: 'xMidYMid slice',
  },
}

const Hero = () => {
  const history = useHistory()

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="flex justify-between items-start h-full my-4 py-8 px-16">
        <div>
          <Heading fontSize="large" className="text-6xl font-bold">
            <span className="text-yellow-500">Create</span> Videos that Soar
          </Heading>
          <Text fontSize="normal" className="text-xl mx-2">
            The community-first platform for creating developer video content
          </Text>
          <div className="flex mx-2 my-16">
            <Button
              type="button"
              appearance="primary"
              className="bg-yellow-500 border-none text-background mr-4 py-2"
              onClick={() => history.push('/dashboard')}
            >
              Explore
            </Button>
            <Button type="button" appearance="primary">
              Request a demo
            </Button>
          </div>
        </div>
        <div>
          <Lottie options={defaultOptions} width={400} />
        </div>
      </section>
    </div>
  )
}

export default Hero
