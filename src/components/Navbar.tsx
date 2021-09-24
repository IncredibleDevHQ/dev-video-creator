import React from 'react'
import { Link, useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { FiArrowRight, FiSearch } from 'react-icons/fi'
import Gravatar from 'react-gravatar'
import { User, userState } from '../stores/user.store'
import { Auth, authState } from '../stores/auth.store'
import Button from './Button'
import { ASSETS } from '../constants'

const AuthenticatedRightCol = () => {
  const { picture, displayName, email } =
    (useRecoilValue(userState) as User) || {}
  const history = useHistory()

  return (
    <div className="flex items-center">
      <div
        role="button"
        tabIndex={0}
        onKeyUp={() => {
          history.push('/profile')
        }}
        onClick={() => {
          history.push('/profile')
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
    </div>
  )
}

const Navbar = ({ hideNav }: { hideNav?: boolean }) => {
  const history = useHistory()
  const { isAuthenticated } = (useRecoilValue(authState) as Auth) || {}

  return (
    <nav className="flex flex-row items-center px-4 py-2 justify-between border-b-2">
      <img
        src={ASSETS.ICONS.IncredibleLogo}
        alt=""
        className="w-28 cursor-pointer"
      />

      {isAuthenticated ? (
        <AuthenticatedRightCol />
      ) : (
        <div className="flex gap-2 flex-row">
          <Link to="login">
            <Button
              type="button"
              appearance="primary"
              size="small"
              iconPosition="right"
              icon={FiArrowRight}
            >
              Login
            </Button>
          </Link>

          <Button
            type="button"
            appearance="link"
            size="large"
            iconPosition="right"
            icon={FiSearch}
            onClick={() => history.push('/')}
          >
            Explore Incredible
          </Button>
        </div>
      )}
    </nav>
  )
}

Navbar.defaultProps = {
  hideNav: undefined,
}

export default Navbar
