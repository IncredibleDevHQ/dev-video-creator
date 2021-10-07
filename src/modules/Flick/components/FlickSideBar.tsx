import React, { useState } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Tab, TabBar } from '../../../components'
import { FlickFragmentFragment } from '../../../generated/graphql'
import { currentFlickStore } from '../../../stores/flick.store'
import { User, userState } from '../../../stores/user.store'
import Notes from './Notes'
import Participants from './Participants'

const FlickSideBar = ({
  handleRefetch,
  fragment,
}: {
  handleRefetch: (refresh?: boolean) => void
  fragment?: FlickFragmentFragment
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
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])
  const [flick] = useRecoilState(currentFlickStore)
  const [isParticipants, setParticipants] = useState(true)

  return (
    <div className="flex flex-col w-1/6 h-full overflow-y-auto py-2 px-4 bg-background-alt">
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
      {currentTab.value === 'Notes' && (
        <Notes
          fragmentId={fragment?.id as string}
          flickId={flick?.id}
          participantId={
            fragment?.participants.find(
              ({ participant }) => participant.userSub === sub
            )?.participant.id
          }
        />
      )}
    </div>
  )
}

export default FlickSideBar
