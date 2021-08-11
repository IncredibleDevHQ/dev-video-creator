import React, { useEffect } from 'react'
import Select from 'react-select'
import { EmptyState } from '../../../components'
import { OrganisationFragment } from '../../../generated/graphql'

const OrganisationSelect = ({
  organisations,
  setSelectedOrganisation,
  selectedOrganisation,
}: {
  organisations: OrganisationFragment[] | null
  setSelectedOrganisation: React.Dispatch<
    React.SetStateAction<OrganisationFragment | undefined>
  >
  selectedOrganisation: OrganisationFragment | undefined
}) => {
  if (!organisations)
    return (
      <EmptyState width={400} text="You're not a part of any organisation" />
    )

  useEffect(() => {
    setSelectedOrganisation(organisations[0])
  }, [])

  const options = organisations.map((org) => {
    return { value: org, label: org.slug }
  })

  return (
    <Select
      onChange={(value) => setSelectedOrganisation(value?.value)}
      options={options}
      value={{ value: selectedOrganisation, label: selectedOrganisation?.slug }}
      placeholder="Select an Organisation"
    />
  )
}

export default OrganisationSelect
