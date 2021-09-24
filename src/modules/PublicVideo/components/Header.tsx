import React, { useEffect, useState } from 'react'
import Gravatar from 'react-gravatar'
import { FiBell, FiDownload } from 'react-icons/fi'
import {
  IoEllipsisHorizontalSharp,
  IoLinkOutline,
  IoShareSocialOutline,
} from 'react-icons/io5'
import { Link, useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { MoreOptionsModal, RequestAccessModal, ShareButtonModal } from '.'
import { Button } from '../../../components'
import { ASSETS } from '../../../constants'
import { Auth, authState } from '../../../stores/auth.store'
import { User, userState } from '../../../stores/user.store'

const AuthenticatedRightCol = ({ flickOwnerId }: { flickOwnerId: string }) => {
  const [moreOptionsModal, setMoreOptionsModal] = useState(false)
  const [openShareModal, setOpenShareModal] = useState(false)
  const { picture, displayName, email, sub } =
    (useRecoilValue(userState) as User) || {}
  const history = useHistory()

  useEffect(() => {
    console.log('flickOwnerId  ', flickOwnerId === sub)
  }, [flickOwnerId])

  return (
    <div className="flex  w-full justify-end">
      <Button
        className="text-sm font-semibold "
        type="button"
        icon={IoLinkOutline}
        onClick={() => navigator.clipboard.writeText(window.location.href)}
        appearance={flickOwnerId === sub ? 'primary' : 'link'}
      >
        Copy Public Link
      </Button>
      <Button
        type="button"
        icon={IoShareSocialOutline}
        size="large"
        onClick={() => setOpenShareModal(true)}
        appearance="link"
      />
      <Button type="button" icon={FiDownload} size="large" appearance="link" />
      <Button
        type="button"
        icon={IoEllipsisHorizontalSharp}
        size="large"
        onClick={() => setMoreOptionsModal(true)}
        appearance="link"
      />
      <div className="bg-gray-300 flex w-0.5 mr-3" />

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

const Header = ({ link, owernId }: { link: string; owernId: string }) => {
  const [requestAccessModal, setRequestAccessModal] = useState(false)
  const [moreOptionsModal, setMoreOptionsModal] = useState(false)
  const [openShareModal, setOpenShareModal] = useState(false)
  const { isAuthenticated } = (useRecoilValue(authState) as Auth) || {}

  return (
    <div>
      <div className="flex w-full flex-row pt-3 pb-3 ml-6 ">
        <img alt="incredible.dev" src={ASSETS.ICONS.Incredible_logo} />

        {isAuthenticated ? (
          <AuthenticatedRightCol flickOwnerId={owernId} />
        ) : (
          <div className="flex  flex-row w-full justify-end">
            <Button
              className="text-sm font-semibold "
              type="button"
              icon={IoLinkOutline}
              onClick={() =>
                navigator.clipboard.writeText(window.location.href)
              }
              appearance="link"
            >
              Copy Public Link
            </Button>
            <Button
              type="button"
              icon={IoShareSocialOutline}
              size="large"
              onClick={() => setOpenShareModal(true)}
              appearance="link"
            />
            <Button
              type="button"
              icon={FiDownload}
              size="large"
              appearance="link"
            />
            <Link to="login">
              <Button type="button" appearance="link" size="small">
                Sign In
              </Button>
            </Link>
            <Button
              type="button"
              appearance="primary"
              size="small"
              iconPosition="right"
              onClick={() => setRequestAccessModal(true)}
            >
              Request Access
            </Button>
          </div>
        )}
      </div>
      <div className="flex bg-gray-300 w-screen h-0.5 flex-row" />
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
