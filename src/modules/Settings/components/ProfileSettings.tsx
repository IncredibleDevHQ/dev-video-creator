import React, { useEffect, useRef, useState } from 'react'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { emitToast } from '../../../components'
import { useUpdateProfileMutation } from '../../../generated/graphql'
import useDidUpdateEffect from '../../../hooks/use-did-update-effect'
import { userState, databaseUserState } from '../../../stores/user.store'

const ProfileSettings = () => {
  const {
    sub,
    displayName,
    designation: storeDesignation,
    organization: storeOrganization,
  } = useRecoilValue(userState) || {}

  const setDatabaseUser = useSetRecoilState(databaseUserState)

  const [name, setName] = useState<string>(displayName || '')
  const [designation, setDesignation] = useState<string>(storeDesignation || '')
  const [organization, setOrganization] = useState<string>(
    storeOrganization || ''
  )

  const [updateProfile, { error }] = useUpdateProfileMutation()

  useEffect(() => {
    if (!error) return
    emitToast({
      type: 'error',
      title: 'Could not update your profile details',
      autoClose: 3000,
    })
  }, [error])

  const debouncedUpdateProfile = useDebouncedCallback(
    (displayName: string, designation: string, organization: string) => {
      updateProfile({
        variables: {
          userId: sub as string,
          displayName,
          designation,
          organization,
        },
      })
      setDatabaseUser((user) => ({
        ...user,
        displayName,
        designation,
        organization,
      }))
    },
    1000
  )

  const initialLoad = useRef<boolean>(true)

  useDidUpdateEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false
      return
    }
    debouncedUpdateProfile(name, designation, organization)
  }, [name, designation, organization])

  return (
    <div className="flex flex-col">
      <span className="text-sm">Your name</span>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Jane Doe"
        className="mt-2 w-2/5 bg-dark-400 py-2 px-2.5 rounded-sm focus:ring-0 focus:outline-none text-sm font-body border border-transparent focus:border-brand"
      />
      <span className="text-sm mt-12">Designation</span>
      <input
        value={designation}
        onChange={(e) => setDesignation(e.target.value)}
        placeholder="Designation"
        className="mt-2 w-2/5 bg-dark-400 py-2 px-2.5 rounded-sm focus:ring-0 focus:outline-none text-sm font-body border border-transparent focus:border-brand"
      />
      <span className="text-sm mt-12">Organization</span>
      <input
        value={organization}
        onChange={(e) => setOrganization(e.target.value)}
        placeholder="Organization"
        className="mt-2 w-2/5 bg-dark-400 py-2 px-2.5 rounded-sm focus:ring-0 focus:outline-none text-sm font-body border border-transparent focus:border-brand"
      />
    </div>
  )
}

export default ProfileSettings
