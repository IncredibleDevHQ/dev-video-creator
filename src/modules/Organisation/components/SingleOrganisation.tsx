import { QueryLazyOptions } from '@apollo/client'
import React, { useState } from 'react'
import { Exact, Maybe, OrganisationFragment } from '../../../generated/graphql'
import Members from './Members/Members'
import Series from './Series/Series'

interface Props {
  selectedOrganisation: OrganisationFragment | undefined
  GetUserOrganisations: (
    options?:
      | QueryLazyOptions<
          Exact<{
            sub?: Maybe<string> | undefined
          }>
        >
      | undefined
  ) => void
}

const SingleOrganisation = ({
  selectedOrganisation,
  GetUserOrganisations,
}: Props) => {
  const [selectedTab, setSelectedTab] = useState<number>(1)

  if (!selectedOrganisation) return <></>

  return (
    <div>
      <div className="flex pt-4 pb-4 gap-4">
        <button
          type="button"
          className={`cursor-pointer p-4 pt-2 pb-2 ${
            selectedTab === 1 && 'bg-blue-500 text-white rounded-full'
          }`}
          onClick={() => setSelectedTab(1)}
        >
          Series
        </button>
        <button
          type="button"
          className={`cursor-pointer p-4 pt-2 pb-2 ${
            selectedTab === 2 && 'bg-blue-500 text-white rounded-full'
          }`}
          onClick={() => setSelectedTab(2)}
        >
          Members
        </button>
      </div>
      <div>
        {selectedTab === 1 && (
          <Series organisationSlug={selectedOrganisation.slug} />
        )}
        {selectedTab === 2 && (
          <Members
            GetUserOrganisations={GetUserOrganisations}
            members={selectedOrganisation.members}
            organisationSlug={selectedOrganisation.slug}
          />
        )}
      </div>
    </div>
  )
}

export default SingleOrganisation
