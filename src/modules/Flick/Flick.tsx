import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import {
  AddFragmentModal,
  FragmentActivity,
  FragmentConfiguration,
  FragmentParticipants,
  FragmentsSidebar,
  Participants,
} from './components'
import { currentFlickStore } from '../../stores/flick.store'
import { EmptyState, ScreenState, Tab, TabBar } from '../../components'
import { useGetFlickByIdQuery } from '../../generated/graphql'

const tabs: Tab[] = [
  {
    name: 'Activity',
    value: 'Activity',
  },
  {
    name: 'Configuration',
    value: 'Configuration',
  },
  {
    name: 'Participants',
    value: 'Participants',
  },
]

const Flick = () => {
  const { id } = useParams<{ id: string }>()
  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
  })
  const [flick, setFlick] = useRecoilState(currentFlickStore)
  const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])
  const [isParticipants, setParticipants] = useState(true)
  const [isAddFragmentModal, setAddFragmentModal] = useState(false)
  const [activeFragmentId, setActiveFragmentId] = useState<string>()

  useEffect(() => {
    if (!data?.Flick_by_pk) return
    setFlick(data.Flick_by_pk)
    setActiveFragmentId(
      data.Flick_by_pk.fragments.length > 0
        ? data.Flick_by_pk.fragments[0].id
        : undefined
    )
  }, [data])

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  if (!flick)
    return (
      <ScreenState
        title="Something went wrong!!"
        subtitle="We couldn't find the details of this flick"
      />
    )

  return (
    <section className="flex flex-row relative">
      <FragmentsSidebar
        flickId={flick.id}
        fragments={flick.fragments}
        activeFragmentId={activeFragmentId}
        setActiveFragmentId={setActiveFragmentId}
        setAddFragmentModal={setAddFragmentModal}
      />
      <div className="flex-1 p-4">
        <h3 className=" flex font-black text-2xl capitalize justify-center mb-2">
          {flick.name}
        </h3>
        {activeFragmentId ? (
          <div>
            <TabBar
              tabs={tabs}
              current={currentTab}
              onTabChange={setCurrentTab}
            />
            {currentTab.value === 'Configuration' && (
              <FragmentConfiguration
                fragment={flick.fragments.find(
                  (fragment) => fragment.id === activeFragmentId
                )}
              />
            )}
            {currentTab.value === 'Activity' && (
              <FragmentActivity
                fragment={flick.fragments.find(
                  (fragment) => fragment.id === activeFragmentId
                )}
              />
            )}
            {currentTab.value === 'Participants' && (
              <FragmentParticipants
                participants={flick.participants}
                fragmentId={
                  flick.fragments.find(
                    (fragment) => fragment.id === activeFragmentId
                  )?.id
                }
              />
            )}
          </div>
        ) : (
          <>
            <EmptyState text="No Fragment is selected" width={400} />
          </>
        )}
      </div>
      <Participants
        isParticipants={isParticipants}
        setParticipants={setParticipants}
        participants={flick.participants}
        flickId={flick.id}
        handleRefetch={(refresh) => {
          if (refresh) refetch()
        }}
      />
      <AddFragmentModal
        open={isAddFragmentModal}
        flickId={flick.id}
        participants={flick.participants}
        totalFragments={flick.fragments.length}
        handleClose={(refresh) => {
          if (refresh) refetch()
          setAddFragmentModal(false)
        }}
      />
    </section>
  )
}

export default Flick
