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
import { Button, Heading } from '../../../components'
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
  const { picture, displayName, email, sub, uid } =
    (useRecoilValue(userState) as User) || {}
  const history = useHistory()

  useEffect(() => {
    console.log('flickOwnerId  ', owner, uid)
  }, [owner])

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

      <div
        role="button"
        tabIndex={0}
        className="mr-3"
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
            className="w-8 h-8 rounded-full ml-3 bg-gray-100"
          />
        ) : (
          <Gravatar
            className="w-8 h-8 rounded-full bg-gray-100"
            email={email as string}
          />
        )}
      </div>
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

  return (
    <div>
      <div className="flex w-full flex-row pt-3 pb-3 pl-6 ">
        <img alt="incredible.dev" src={ASSETS.ICONS.Incredible_logo} />

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

            <IoEllipsisHorizontalSharp
              className="m-3 mr-8"
              onClick={() => setMoreOptionsModal(true)}
            />
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
