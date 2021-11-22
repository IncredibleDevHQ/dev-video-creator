import axios from 'axios'
import React, { useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import Gravatar from 'react-gravatar'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { emitToast, Tooltip } from '.'
import config from '../config'
import { ASSETS } from '../constants'
import firebaseState from '../stores/firebase.store'
import { userState } from '../stores/user.store'
import Button from './Button'

const AuthenticatedRightCol = () => {
  const history = useHistory()
  const { picture, displayName, email } = useRecoilValue(userState) || {}
  const [isOpen, setIsOpen] = useState(false)
  const fbState = useRecoilValue(firebaseState)

  const handleSignOut = async () => {
    try {
      await fbState.auth.signOut()
      await axios.post(`${config.auth.endpoint}/logout`)
      window.location.href = config.auth.endpoint
    } catch (error) {
      emitToast({
        type: 'error',
        title: 'Error signing out',
      })
    }
  }

  return (
    <div className="flex items-center">
      <Tooltip
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        content={
          <ul className="bg-gray-100 rounded-md">
            <li>
              <Button
                onClick={() => {
                  handleSignOut()
                }}
                type="button"
                appearance="link"
                className="text-base w-32"
              >
                Sign out
              </Button>
            </li>
            <li>
              <Button
                onClick={() => {
                  history.push('integrations')
                }}
                type="button"
                appearance="link"
                className="text-base w-32"
              >
                Integrations
              </Button>
            </li>
          </ul>
        }
        placement="bottom-start"
        triggerOffset={20}
      >
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {
            setIsOpen(!isOpen)
          }}
          onClick={() => {
            setIsOpen(!isOpen)
          }}
        >
          <div className="w-8 h-8 relative">
            <span
              style={{ zIndex: 0 }}
              className="top-0 left-0 w-8 h-8 rounded-full absolute animate-spin-slow "
            />
            <div className="z-10  w-8 h-8  absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 left-1/2">
              {picture ? (
                <img
                  src={picture}
                  alt={displayName || 'user'}
                  className="w-8 h-8 rounded-full bg-gray-100"
                />
              ) : (
                <Gravatar
                  className="w-8 h-8 rounded-full bg-gray-100"
                  email={email as string}
                />
              )}
            </div>
          </div>
        </div>
      </Tooltip>
    </div>
  )
}

const Navbar = () => {
  const history = useHistory()
  const fbState = useRecoilValue(firebaseState)
  const [user] = useAuthState(fbState.auth)

  return (
    <nav className="flex flex-row items-center px-4 py-2 justify-between border-b-2">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <img
        src={ASSETS.ICONS.IncredibleLogo}
        alt="Incredible"
        className="w-28 cursor-pointer"
        onClick={() => {
          history.push('/dashboard')
        }}
      />

      {user && <AuthenticatedRightCol />}
    </nav>
  )
}

Navbar.defaultProps = {
  hideNav: undefined,
}

export default Navbar
