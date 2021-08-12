import React from 'react'
import { Link } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { Auth, authState } from '../../stores/auth.store'
import { Button, Navbar } from '../../components'
import hero from '../../assets/hero.png'

const Landing = () => {
  const { isAuthenticated } = (useRecoilValue(authState) as Auth) || {}
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar hideNav />
      <div className="flex-grow flex flex-col mt-8 w-full md:w-1/2 mx-auto">
        <h1 className="text-5xl bg-clip-text text-transparent bg-gradient-to-r from-brand to-brand-alt leading-snug text-center font-extrabold">
          Create Developer Videos That Soar
        </h1>
        <p className="mt-2 text-xl text-center">
          Welcome to the world&apos;s most innovative, easiest and coolest tools
          for making developer content.
        </p>
        {isAuthenticated && (
          <Link to="dashboard">
            <Button
              className="mt-4 mx-auto"
              appearance="primary"
              size="small"
              type="button"
            >
              Dashboard
            </Button>
          </Link>
        )}
      </div>
      <img
        className="h-72 hidden md:block shadow-2xl fixed -bottom-8 transform -translate-x-1/2 left-1/2"
        src={hero}
        alt="Screen"
      />
    </div>
  )
}

export default Landing
