import React, { useState, useEffect } from 'react'
import Gravatar from 'react-gravatar'
import { useParams } from 'react-router-dom'
import { Text } from '../../components'
import {
  PublicOrganisationFragment,
  usePublicOrganisationQuery,
} from '../../generated/graphql'

const PublicOrganisationPage = () => {
  const [organisation, setOrganisation] =
    useState<PublicOrganisationFragment | null>()
  const { organisationSlug }: { organisationSlug: string } = useParams()

  const { data, loading, error } = usePublicOrganisationQuery({
    variables: {
      organisationSlug,
    },
  })

  useEffect(() => {
    setOrganisation(data?.Organisation_by_pk)
  }, [data])

  console.log(data?.Organisation_by_pk, loading)

  return (
    <div className="flex flex-col w-full items-center">
      <div className="flex">
        {organisation?.picture ? (
          <img
            src={organisation.picture}
            alt={organisation.name}
            className="w-40 h-40 mx-3 my-2 rounded"
          />
        ) : (
          <Gravatar
            className="w-40 h-40 mx-3 my-2 rounded"
            email={organisation?.name as string}
          />
        )}
        <div className="flex flex-col justify-center">
          <Text className="text-3xl font-bold">{organisation?.name}</Text>
          <Text className=" text-black text-opacity-50 ">
            {organisation?.description}
          </Text>
          <Text className=" text-black text-opacity-50 ">
            {organisation?.series.length ? organisation?.series.length + 1 : 0}{' '}
            Series
          </Text>
          <Text className=" text-black text-opacity-50 ">
            {organisation?.members.length
              ? organisation?.members.length + 1
              : 0}{' '}
            Members
          </Text>
        </div>
      </div>
    </div>
  )
}

export default PublicOrganisationPage
