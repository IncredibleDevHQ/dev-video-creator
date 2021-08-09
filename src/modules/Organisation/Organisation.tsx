import { User } from '@sentry/react'
import React, { useEffect, useState } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import { emitToast, Navbar, ScreenState } from '../../components'
import {
  OrganisationFragment,
  useGetUserOrganisationsLazyQuery,
} from '../../generated/graphql'
import { userState } from '../../stores/user.store'
import {
  NewOrganisationBanner,
  OrganisationSelect,
  SingleOrganisation,
} from './components/index'
import { organisationsStore } from '../../stores/organisation.store'

const Organisation = () => {
  const { uid } = (useRecoilValue(userState) as User) || {}
  const [GetUserOrganisations, { data, error, loading }] =
    useGetUserOrganisationsLazyQuery()

  const [organisations, setOrganisations] = useRecoilState(organisationsStore)
  const [selectedOrganisation, setSelectedOrganisation] =
    useState<OrganisationFragment>()

  const [organisationCreated, setOrganisationCreated] = useState<boolean>(false)

  useEffect(() => {
    GetUserOrganisations({
      variables: {
        sub: uid as string,
      },
    })
    if (!data) return
    setOrganisations(data.Organisation)
  }, [data, organisationCreated])

  useEffect(() => {
    if (!error) return
    emitToast({
      title: "Couldn't fetch the organisations",
      type: 'error',
      description: `Click this toast to refresh and give it another try.`,
      onClick: () => window.location.reload(),
    })
  }, [error])

  return (
    <div className="">
      <Navbar />
      {loading ? (
        <ScreenState title="Loading Organisations" loading />
      ) : (
        <div className="p-4 pt-0">
          <OrganisationSelect
            organisations={organisations}
            setSelectedOrganisation={setSelectedOrganisation}
          />
          <SingleOrganisation
            selectedOrganisation={selectedOrganisation}
            organisationCreated={organisationCreated}
            setOrganisationCreated={setOrganisationCreated}
          />
        </div>
      )}
      <NewOrganisationBanner className="fixed bottom-0" />
    </div>
  )
}

export default Organisation
