import React, { useState, useEffect } from 'react'
import Gravatar from 'react-gravatar'
import { Link, useParams } from 'react-router-dom'
import { Navbar, ScreenState, TabBar, Text } from '../../components'
import {
  PublicOrganisationFragment,
  usePublicOrganisationQuery,
} from '../../generated/graphql'

const PublicOrganisationPage = () => {
  const [activeTab, setActiveTab] = useState({
    name: 'Series',
    value: 'series',
  })
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

  const tabs = [
    { name: 'Series', value: 'series' },
    { name: 'Flicks', value: 'flicks' },
    { name: 'Members', value: 'members' },
  ]

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <>
      <Navbar />
      <div className="flex flex-col w-full px-5">
        <div className="flex">
          {organisation?.picture ? (
            <img
              src={organisation.picture}
              alt={organisation.name}
              className="w-40 h-40 mr-5 rounded"
            />
          ) : (
            <Gravatar
              className="w-40 h-40 mr-5 rounded"
              email={organisation?.name as string}
            />
          )}
          <div className="flex flex-col justify-around">
            <Text className="text-6xl font-bold capitalize">
              {organisation?.name}
            </Text>
            <Text className=" text-black text-opacity-70">
              {organisation?.description}
            </Text>
            <div className="justify-around text-black text-opacity-50 ">
              <Text>
                {organisation?.series.length
                  ? organisation?.series.length + 1
                  : 0}{' '}
                Series
              </Text>

              <Text>
                {organisation?.members.length
                  ? organisation?.members.length + 1
                  : 0}{' '}
                Members
              </Text>
            </div>
          </div>
        </div>

        <TabBar
          onTabChange={(tab) => setActiveTab(tab)}
          current={{ name: 'Series', value: 'series' }}
          tabs={tabs}
          className="bg-blue-500 p-2 text-white mt-5 rounded gap-2"
        />

        {activeTab.value === 'series' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 grid-cols-1 pt-2">
            {organisation?.series?.map((series) => (
              <Link
                to={`/series/${series.name.split(' ').join('-')}--${series.id}`}
                key={series.id}
                className="flex cursor-pointer hover:bg-blue-200 items-center justify-between bg-blue-100 p-3 rounded-md m-1"
              >
                <div className="flex gap-5">
                  {series.picture ? (
                    <img
                      className="rounded-md max-h-20"
                      src={series.picture}
                      alt={series.name}
                    />
                  ) : (
                    <Gravatar
                      className="rounded-md h-20 w-20"
                      email={series.name as string}
                    />
                  )}
                  <div className="flex flex-col justify-around">
                    <span>{series.name}</span>
                    <span>{series.description}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {activeTab.value === 'members' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 grid-cols-1">
            {organisation?.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between bg-blue-100 p-3 rounded-md m-1"
              >
                <div className="flex items-center gap-5">
                  {member.user.picture ? (
                    <img
                      className="rounded-md max-h-20"
                      src={member.user.picture}
                      alt={member.user.username}
                    />
                  ) : (
                    <Gravatar
                      className="rounded-md h-20 w-20"
                      email={member.user.username as string}
                    />
                  )}
                  <div className="flex flex-col">
                    <span>{member.user.displayName}</span>
                    <span>{member.user.username}</span>
                  </div>
                </div>
                <span>{member.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default PublicOrganisationPage
