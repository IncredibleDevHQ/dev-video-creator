import React from 'react'
import { Link, NavLink, useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { FiArrowRight, FiBell, FiSearch } from 'react-icons/fi'
import Gravatar from 'react-gravatar'
import { cx } from '@emotion/css'
import { User, userState } from '../../../stores/user.store'
import logo from '../../../assets/logo.svg'
import { Auth, authState } from '../../../stores/auth.store'
import { Button } from '../../../components'
import { ASSETS } from '../../../constants'

const LinkItem = ({ children, to }: { children: string; to: string }) => (
  <NavLink activeClassName="text-brand" className={cx('font-semibold')} to={to}>
    <li>{children}</li>
  </NavLink>
)

const AuthenticatedRightCol = () => {
  const { picture, displayName, email } =
    (useRecoilValue(userState) as User) || {}
  const history = useHistory()

  return (
    <div className="flex items-center">
      <div className="relative mr-4">
        <span
          style={{ top: 0, right: 2 }}
          className="block bg-red-600  absolute w-1.5 h-1.5 rounded-full"
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 duration-500 opacity-75" />
        </span>
        <FiBell />
      </div>

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
            className="top-0 left-0 w-8 h-8 rounded-full absolute animate-spin-slow bg-gradient-to-r from-brand to-brand-alt"
          />
          <div className="z-10 absolute top-1/2 w-6 h-6 transform -translate-x-1/2 -translate-y-1/2 left-1/2">
            {picture ? (
              <img
                src={picture}
                alt={displayName || 'user'}
                className="w-6 h-6 rounded-full bg-gray-100"
              />
            ) : (
              <Gravatar
                className="w-6 h-6 rounded-full bg-gray-100"
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
    <nav className="flex flex-row items-center m-4 px-4 py-2 bg-gray-100 rounded-lg justify-between">
      <img alt="incredible.dev" src={ASSETS.ICONS.Incredible_logo} />

      {hideNav ? (
        <span />
      ) : (
        <ul className="grid grid-flow-col md:gap-x-6 gap-x-4">
          <LinkItem to="/dashboard">Dashboard</LinkItem>
          <LinkItem to="/organisations">Organisations</LinkItem>
          <LinkItem to="/circle">Circle</LinkItem>
        </ul>
      )}

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
              Sign In
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