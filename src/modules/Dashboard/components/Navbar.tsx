/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cx } from '@emotion/css'
import axios from 'axios'
import React, { HTMLAttributes, useState } from 'react'
import { IoAlbumsOutline, IoChevronDown } from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { Logo, Text, Tooltip, Button } from '../../../components'
import CreateFlickModal from './CreateFlickModal'
import Notifications from './NotificationModal'
import { User, userState } from '../../../stores/user.store'
import firebaseState from '../../../stores/firebase.store'

const Navbar = ({
  className,
  altAppearance = false,
  handleRefresh,
}: {
  altAppearance?: boolean
  handleRefresh?: () => void
} & HTMLAttributes<HTMLDivElement>) => {
  const { username, picture, sub, displayName } =
    (useRecoilValue(userState) as User) || {}
  const { auth } = useRecoilValue(firebaseState)

  const history = useHistory()

  const handleSignOut = async () => {
    await auth.signOut()
    history.push('/login')
    axios.post('/api/logout', {
      withCredentials: true,
    })
  }

  const [isOpen, setIsOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreateFlickOpen, setIsCreateFlickOpen] = useState(false)

  return (
    <nav
      className={cx(
        'flex justify-between items-center px-5 py-3.5 w-full',
        className
      )}
    >
      <Logo
        className="cursor-pointer"
        size="medium"
        theme="dark"
        onClick={() => {
          if (sub) history.push('/dashboard')
          else history.push('/')
        }}
      />
      {sub ? (
        <div className="flex items-center justify-center gap-x-6">
          <Tooltip
            isOpen={isCreateOpen}
            setIsOpen={setIsCreateOpen}
            content={
              <ul className="-mt-2 text-gray-100 rounded-md shadow-xl bg-dark-200">
                <li
                  className="flex items-center justify-center p-4 pb-3 cursor-pointer rounded-t-md hover:bg-dark-100 gap-x-4"
                  onClick={() => {
                    setIsCreateOpen(false)
                  }}
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-dark-400">
                    <IoAlbumsOutline className="bg-dark-400" size={24} />
                  </div>
                  <div className="flex flex-col">
                    <Text className="font-bold font-main">Series</Text>
                    <Text className="text-dark-body-200">
                      Create a series of flicks
                    </Text>
                  </div>
                </li>
                <li
                  className="flex items-center justify-start p-4 pt-3 cursor-pointer rounded-b-md hover:bg-dark-100 gap-x-4"
                  onClick={() => {
                    setIsCreateOpen(false)
                    setIsCreateFlickOpen(true)
                  }}
                >
                  <div className="bg-dark-400 flex items-center justify-center w-12 h-12 rounded-lg py-3.5 px-3">
                    <div className="w-full h-full border border-gray-100 rounded-sm" />
                  </div>
                  <div className="flex flex-col">
                    <Text className="font-bold font-main">Flick</Text>
                    <Text className="text-dark-body-200">Create a flick</Text>
                  </div>
                </li>
              </ul>
            }
            placement="bottom-end"
            triggerOffset={20}
          >
            <Button
              type="button"
              appearance={altAppearance ? 'secondary' : 'primary'}
              className="flex items-center gap-x-2"
              onClick={() => setIsCreateOpen(!isCreateOpen)}
            >
              <span>Create Story </span>
              <IoChevronDown />
            </Button>
          </Tooltip>
          {auth.currentUser?.uid && <Notifications />}
          <Tooltip
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            content={
              <ul className="-mt-2 font-semibold text-gray-100 rounded-md shadow-xl bg-dark-200 font-main">
                <li
                  className="p-2 px-6 font-semibold cursor-pointer rounded-t-md hover:bg-dark-100 font-main"
                  onClick={() => {
                    history.push(`/profile/${username}`)
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
                <li
                  className="p-2 px-6 font-semibold cursor-pointer rounded-t-md hover:bg-dark-100 font-main"
                  onClick={() => history.push('/branding')}
                >
                  Branding
                </li>
                <div className="w-full border-t border-dark-100" />
                <li
                  className="p-2 px-6 cursor-pointer text-dark-title-200 rounded-b-md hover:bg-dark-100"
                  onClick={() => handleSignOut()}
                >
                  Sign out
                </li>
              </ul>
            }
            placement="bottom-start"
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
      ) : (
        <div className="flex items-center justify-center gap-x-4">
          <Button
            type="button"
            appearance="secondary"
            onClick={() => {
              history.push(
                `${'/login?redirect='}${encodeURIComponent(
                  window.location.href
                )}`
              )
            }}
          >
            Sign In
          </Button>
          <Button
            type="button"
            appearance="secondary"
            onClick={() => {
              history.push('/waitlist/join')
            }}
          >
            Join Waitlist
          </Button>
        </div>
      )}
      {isCreateFlickOpen && (
        <CreateFlickModal
          open={isCreateFlickOpen}
          handleRefresh={handleRefresh}
          handleClose={() => {
            setIsCreateFlickOpen(false)
          }}
        />
      )}
    </nav>
  )
}

export default Navbar
