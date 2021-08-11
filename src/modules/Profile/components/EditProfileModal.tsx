import { cx, css } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { toast } from 'react-toastify'
import { useRecoilState } from 'recoil'
import { Maybe } from 'graphql/jsutils/Maybe'
import { databaseUserState, User } from '../../../stores/user.store'
import {
  UserFragment,
  useUpdateProfileMutation,
} from '../../../generated/graphql'

const EditProfileModal = ({
  open,
  handleClose,
  userdata,
}: {
  open: boolean
  handleClose: () => void
  userdata: Partial<User> & Partial<UserFragment>
}) => {
  const [updateProfileDetails, { data }] = useUpdateProfileMutation()
  const [userDetails, setUserDetails] = useRecoilState(databaseUserState)
  const [name, setName] = useState<Maybe<string>>(userDetails?.displayName)

  useEffect(() => {
    if (data && data.update_User) {
      toast('🥳 Your profile details have been updated successfully! 🥳', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        className: css({
          background: '#ffe2eb !important',
        }),
      })
    }
  }, [data])

  useEffect(() => {
    setUserDetails({ ...userDetails, displayName: name as string })
  }, [name])

  const updateDetails = async () => {
    await updateProfileDetails({
      variables: {
        userId: userdata.sub as string,
        displayName: name as string,
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-1/2',
          css`
              background-color: #9ef7ff !important
              border: #02737d !important
        ;
            `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
    >
      <div className="w-100,h-100">
        <p className="text-xl font-semibold mb-4"> Edit Profile! </p>
        <p className="m-2">Display Name</p>
        <input
          type="text"
          className="px-3 py-3 mb-3 placeholder-blueGray-300 text-blueGray-600 relative border-2 border-blue-400  rounded text-lg shadow outline-none focus:outline-none focus:ring w-full"
          value={name as string}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setName(e.target.value)
          }}
        />

        <div className="flex flex-row gap-3">
          <button
            type="button"
            className="flex justify-end p-2 text-base bg-blue-400  text-white rounded-lg mt-4"
            onClick={() => {
              updateDetails()
              handleClose()
            }}
          >
            Save
          </button>

          <button
            type="button"
            className="flex justify-end text-base p-2 text-white rounded-lg bg-blue-400 mt-4"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default EditProfileModal
