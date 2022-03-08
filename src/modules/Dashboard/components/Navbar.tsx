/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cx } from '@emotion/css'
import axios from 'axios'
import React, { HTMLAttributes, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { Logo, Tooltip } from '../../../components'
import config from '../../../config'
import firebaseState from '../../../stores/firebase.store'
import { User, userState } from '../../../stores/user.store'
import Notifications from './NotificationModal'

const Navbar = ({ className }: HTMLAttributes<HTMLDivElement>) => {
  const { username, picture, displayName } =
    (useRecoilValue(userState) as User) || {}
  const { auth } = useRecoilValue(firebaseState)

  const history = useHistory()

  const handleSignOut = async () => {
    await auth.signOut()
    await axios.post(
      `${config.auth.endpoint}/api/logout`,
      {},
      {
        withCredentials: true,
        method: 'POST',
      }
    )
    window.location.href = `${config.auth.endpoint}/login`
  }

  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav
      className={cx(
        'sticky top-0 flex justify-between items-center px-5 py-3.5 w-full bg-dark-500 z-50',
        className
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (history.location.pathname !== '/dashboard') {
            history.push('/dashboard')
          }
        }}
      >
        <Logo className="cursor-pointer" size="small" theme="dark" />
      </button>
      <div className="flex items-center justify-center gap-x-6">
        <Notifications />
        <Tooltip
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          content={
            <ul className="-mt-1 font-semibold text-gray-100 rounded-md shadow-xl bg-dark-200 font-main">
              <li
                className="p-2 px-6 font-semibold cursor-pointer rounded-t-md hover:bg-dark-100 font-main"
                onClick={() => {
                  window.open(`${config.auth.endpoint}/${username}`)
                }}
              >
                Profile
              </li>
              <li
                className="p-2 px-6 font-semibold cursor-pointer rounded-t-md hover:bg-dark-100 font-main"
                onClick={() => history.push('/integrations')}
              >
                Integrations
              </li>
              <div className="w-full border-t border-dark-100" />
              <li
                className="p-2 px-6 cursor-pointer text-gray-400 rounded-b-md hover:bg-dark-100"
                onClick={() => handleSignOut()}
              >
                Sign out
              </li>
            </ul>
          }
          placement="bottom-end"
          triggerOffset={20}
        >
          <img
            src={picture || '/dp_fallback.png'}
            className="h-10 rounded-full cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
            alt={displayName || ''}
          />
        </Tooltip>
      </div>
    </nav>
  )
}

export default Navbar
