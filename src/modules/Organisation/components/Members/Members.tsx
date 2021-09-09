/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { User } from '@sentry/react'
import React, { useState, useEffect } from 'react'
import Select from 'react-select'
import { useRecoilValue } from 'recoil'
import { emitToast, Loading } from '../../../../components'
import {
  FilteredUserFragment,
  MemberFragment,
  useAddMemberToOrganisationMutation,
  useGetFilteredUsersQuery,
  useGetOrganisationMembersLazyQuery,
} from '../../../../generated/graphql'
import { userState } from '../../../../stores/user.store'

interface Props {
  organisationSlug: string
}

const Members = ({ organisationSlug }: Props) => {
  const { uid } = (useRecoilValue(userState) as User) || {}
  const [search, setSearch] = useState<string>('')
  const [selectedMember, setSelectedMember] = useState<FilteredUserFragment>()
  const [memberCreated, setMemberCreated] = useState<boolean>(false)

  const {
    data,
    error: errorSelect,
    loading: loadingSelect,
  } = useGetFilteredUsersQuery({
    variables: {
      _ilike: `%${search}%`,
    },
  })

  const [
    GetOrganisationMembers,
    { data: dataMembers, error: errorMembers, loading: loadingMembers },
  ] = useGetOrganisationMembersLazyQuery()

  useEffect(() => {
    GetOrganisationMembers({
      variables: {
        organisationSlug,
      },
    })
  }, [memberCreated, organisationSlug])

  const [AddMemberToOrganisationMutation, { loading }] =
    useAddMemberToOrganisationMutation()

  const handleAddMember = async () => {
    try {
      await AddMemberToOrganisationMutation({
        variables: {
          email: selectedMember?.email as string,
          organisationSlug,
        },
      })

      setMemberCreated(!memberCreated)
    } catch (error) {
      emitToast({
        title: 'User Already added',
        type: 'error',
        description: `Click this toast to refresh and give it another try.`,
        onClick: () => window.location.reload(),
      })
    }
  }

  if (loadingMembers) {
    return <Loading />
  }

  if (errorMembers) {
    return <div className="text-xl">Error Loading Series</div>
  }

  return (
    <>
      {uid ===
        dataMembers?.Member.find((member) => member.role === 'Owner')?.user
          .sub && (
        <div className="w-1/3 flex m-1 mt-0 gap-2">
          <Select
            className="flex-1"
            noOptionsMessage={() =>
              errorSelect ? 'Error Occured' : 'Search a Name..'
            }
            onChange={(value) => setSelectedMember(value?.value)}
            options={
              search
                ? data?.User?.map((user: FilteredUserFragment) => {
                    const option = {
                      value: user,
                      label: user.displayName,
                    }
                    return option
                  })
                : []
            }
            isLoading={loadingSelect}
            onInputChange={(value: string) => setSearch(value)}
            placeholder="Search a user"
          />
          {selectedMember && (
            <button
              onClick={handleAddMember}
              type="button"
              className="bg-blue-500 pl-5 pr-5 rounded-md text-white"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          )}
        </div>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 grid-cols-1">
        {dataMembers?.Member.map((member: MemberFragment) => (
          <div
            key={member.id}
            className="flex items-center justify-between bg-blue-100 p-3 rounded-md m-1"
          >
            <div className="flex items-center gap-5">
              <img
                className="rounded-md max-h-20"
                src={member.user.picture!}
                alt={member.user.displayName!}
              />
              <div className="flex flex-col">
                <span>{member.user.displayName}</span>
                <span>{member.user.email}</span>
              </div>
            </div>
            <span>{member.role}</span>
          </div>
        ))}
      </div>
    </>
  )
}

export default Members
