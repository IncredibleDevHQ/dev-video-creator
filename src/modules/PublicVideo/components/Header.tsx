/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import React, { useState } from 'react'
import Gravatar from 'react-gravatar'
import { FiDownload } from 'react-icons/fi'
import {
  IoEllipsisHorizontalSharp,
  IoLinkOutline,
  IoShareSocialOutline,
} from 'react-icons/io5'
import { Link, useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { MoreOptionsModal, RequestAccessModal, ShareButtonModal } from '.'
import { Button, Heading, Tooltip } from '../../../components'
import { ASSETS } from '../../../constants'
import { Auth, authState } from '../../../stores/auth.store'
import { User, userState } from '../../../stores/user.store'

const AuthenticatedRightCol = ({
  owner,
  setOpenShareModal,
  setMoreOptionsModal,
  producedLink,
}: {
  owner: boolean
  setOpenShareModal: React.Dispatch<React.SetStateAction<boolean>>
  setMoreOptionsModal: React.Dispatch<React.SetStateAction<boolean>>
  producedLink: string
}) => {
  const { picture, displayName, email } =
    (useRecoilValue(userState) as User) || {}
  const [isOpen, setIsOpen] = useState(false)
  const { signOut } = (useRecoilValue(authState) as Auth) || {}

  return (
    <div className="flex  flex-row w-full pr-4 justify-end">
      <Button
        className="text-sm  font-semibold "
        type="button"
        icon={IoLinkOutline}
        onClick={() => navigator.clipboard.writeText(window.location.href)}
        appearance={owner ? 'primary' : 'link'}
      >
        Copy Public Link
      </Button>
      <IoShareSocialOutline
        className="m-3 "
        onClick={() => setOpenShareModal(true)}
      />
      <a href={producedLink} className="m-3" download>
        <FiDownload />
      </a>

      <IoEllipsisHorizontalSharp
        className="m-3 mr-8"
        onClick={() => setMoreOptionsModal(true)}
      />

      <div className="bg-gray-300 flex w-0.5 mr-3" />
      <Tooltip
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        content={
          <ul className="bg-gray-100 rounded-md">
            <li>
              <Button
                onClick={() => {
                  signOut?.()
                }}
                type="button"
                appearance="link"
              >
                Sign out
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
              className="top-0 left-0 w-10 h-10 rounded-full absolute animate-spin-slow "
            />
            <div className="z-10  w-10 h-10 pt-2 absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 left-1/2">
              {picture ? (
                <img
                  src={picture}
                  alt={displayName || 'user'}
                  className="w-10 h-10 rounded-full bg-gray-100"
                />
              ) : (
                <Gravatar
                  className="w-10 h-10 rounded-full bg-gray-100"
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

const Header = ({
  link,
  owner,
  flickId,
  producedLink,
}: {
  link: string
  owner: boolean
  flickId: string
  producedLink: string
}) => {
  const [requestAccessModal, setRequestAccessModal] = useState(false)
  const [moreOptionsModal, setMoreOptionsModal] = useState(false)
  const [openShareModal, setOpenShareModal] = useState(false)
  const { isAuthenticated } = (useRecoilValue(authState) as Auth) || {}
  const history = useHistory()

  return (
    <div>
      <div className="flex w-full flex-row pt-3 pb-3 pl-6 ">
        <img
          className="cursor-pointer"
          aria-hidden
          alt="incredible.dev"
          src={ASSETS.ICONS.Incredible_logo}
          onClick={() => {
            history.push(`/dashboard`)
          }}
        />

        {isAuthenticated ? (
          <AuthenticatedRightCol
            producedLink={producedLink}
            setMoreOptionsModal={setMoreOptionsModal}
            setOpenShareModal={setOpenShareModal}
            owner={owner}
          />
        ) : (
          <div className="flex  flex-row w-full pr-4 justify-end">
            <IoLinkOutline className="m-3 mr-0 text-lg cursor-pointer" />
            <Heading
              className="text-sm font-normal m-3 ml-1 cursor-pointer"
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(window.location.href)
              }
            >
              Copy Public Link
            </Heading>

            <IoShareSocialOutline
              className="m-3"
              onClick={() => setOpenShareModal(true)}
            />
            <a href={producedLink} className="m-3" download>
              <FiDownload />
            </a>

            <div className="bg-gray-300 flex w-0.5 mr-3" />
            <Link to="/login" replace>
              <Button appearance="primary" type="button" className="ml-3">
                Sign In
              </Button>
            </Link>
          </div>
        )}
      </div>
      <div className="flex bg-gray-300 w-auto h-0.5 flex-row" />
      <ShareButtonModal
        open={openShareModal}
        handleClose={() => {
          setOpenShareModal(false)
        }}
        link={link}
      />

      <MoreOptionsModal
        open={moreOptionsModal}
        handleClose={() => {
          setMoreOptionsModal(false)
        }}
        flickId={flickId}
      />
      <RequestAccessModal
        open={requestAccessModal}
        handleClose={() => {
          setRequestAccessModal(false)
        }}
      />
    </div>
  )
}

export default Header
