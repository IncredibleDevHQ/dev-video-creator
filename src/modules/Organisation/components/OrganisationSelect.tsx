import React from 'react'
import Select from 'react-select'
import { EmptyState } from '../../../components'
import { OrganisationFragment } from '../../../generated/graphql'

const OrganisationSelect = ({
  organisations,
  setSelectedOrganisation,
}: {
  organisations: OrganisationFragment[] | null
  setSelectedOrganisation: React.Dispatch<
    React.SetStateAction<OrganisationFragment | undefined>
  >
}) => {
  if (!organisations)
    return (
      <EmptyState width={400} text="You're not a part of any organisation" />
    )

  const options = organisations.map((org) => {
    return { value: org, label: org.slug }
  })

  return (
    <Select
      onChange={(value) => setSelectedOrganisation(value?.value)}
      options={options}
      placeholder="Select an Organisation"
    />
  )
}

export default OrganisationSelect
