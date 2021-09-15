import { ApolloQueryResult } from '@apollo/client'
import React, { useState } from 'react'
import { useRecoilState } from 'recoil'
import { Tab, TabBar } from '../../../components'
import { Exact, GetFlickByIdQuery } from '../../../generated/graphql'
import { currentFlickStore } from '../../../stores/flick.store'
import Notes from './Notes'
import Participants from './Participants'

const FlickSideBar = ({
  handleRefetch,
}: {
  handleRefetch: (refresh?: boolean) => void
}) => {
  const tabs: Tab[] = [
    {
      name: 'Participants',
      value: 'Participants',
    },
    {
      name: 'Notes',
      value: 'Notes',
    },
  ]
  const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])
  const [flick, setFlick] = useRecoilState(currentFlickStore)
  const [isParticipants, setParticipants] = useState(true)

  return (
    <div className="flex flex-col w-1/6 h-screen py-2 px-4 bg-background-alt">
      <TabBar tabs={tabs} current={currentTab} onTabChange={setCurrentTab} />
      {currentTab.value === 'Participants' && (
        <Participants
          isParticipants={isParticipants}
          setParticipants={setParticipants}
          participants={(flick && flick.participants) || []}
          flickId={(flick && flick.id) || []}
          handleRefetch={handleRefetch}
        />
      )}
      {currentTab.value === 'Notes' && <Notes flickId={flick?.id as string} />}
    </div>
  )
}

export default FlickSideBar
