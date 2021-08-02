import React from 'react'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { FiBell } from 'react-icons/fi'
import Gravatar from 'react-gravatar'
import { User, userState } from '../stores/user.store'

const Navbar = () => {
  const { picture, displayName, email } =
    (useRecoilValue(userState) as User) || {}
  const history = useHistory()

  return (
    <nav className="w-full flex justify-end items-center py-2 px-4">
      <div className="relative mr-4">
        <span className="block bg-red-600 absolute top-0 right-0 w-2 h-2 rounded-full" />
        <FiBell className="w-6 h-auto" />
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
        {picture ? (
          <img
            src={picture}
            alt={displayName || 'user'}
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <Gravatar
            className="w-12 h-12 rounded-full"
            email={email as string}
          />
        )}
      </div>
    </nav>
  )
}

export default Navbar
