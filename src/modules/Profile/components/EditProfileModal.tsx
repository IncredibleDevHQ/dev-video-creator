import { cx, css } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { Button } from '../../../components'
import { User } from '../../../stores/user.store'
import {
  UserFragment,
  useUpdateProfileMutation,
} from '../../../generated/graphql'
import { toast } from 'react-toastify'

interface UpdatedProfileDetails {
  name: string
}

const EditProfileModal = ({
  open,
  handleClose,
  userdata,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
  userdata: Partial<User> & Partial<UserFragment>
}) => {
  const [details, setDetails] = useState<UpdatedProfileDetails>({ name: '' })
  const [updateProfileDetails, { data }] = useUpdateProfileMutation()

  useEffect(() => {
    setDetails({ name: '' })
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

  const updateDetails = async () => {
    await updateProfileDetails({
      variables: {
        userId: userdata.sub,
        picture: userdata.picture,
        displayName: details.name,
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose(true)
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
          value={details.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setDetails({ name: e.target.value })
          }}
        />

        <div className="flex flex-row gap-3">
          <button
            type="button"
            className="flex justify-end p-2 text-base bg-blue-400  text-white rounded-lg mt-4"
            onClick={() => {
              handleClose(true)
              updateDetails()
            }}
          >
            Save
          </button>

          <button
            type="button"
            className="flex justify-end text-base p-2 text-white rounded-lg bg-blue-400 mt-4"
            onClick={() => {
              handleClose(true)
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
