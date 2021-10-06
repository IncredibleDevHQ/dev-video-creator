import React, { useEffect, useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import Modal from 'react-responsive-modal'
import { useParams } from 'react-router'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  Avatar,
  ScreenState,
  Tab,
  TabBar,
  Text,
  TextField,
} from '../../components'
import { useGetFlickByIdQuery } from '../../generated/graphql'
import { Notes } from '../Flick/components'
import {
  FlickNavBar,
  FragmentBar,
  FragmentContent,
  FragmentSideBar,
} from './components'
import { newFlickStore } from './store/flickNew.store'

const FlickNew = () => {
  const { id } = useParams<{ id: string; fragmentId?: string }>()
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
  })

  useEffect(() => {
    if (!data) return
    const fragmentsLength = data.Flick_by_pk?.fragments.length || 0
    setFlickStore(() => ({
      flick: data.Flick_by_pk || null,
      activeFragmentId:
        fragmentsLength > 0 ? data.Flick_by_pk?.fragments[0].id : '',
    }))
  }, [data])

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState
        title="Something went wrong!!"
        subtitle="Could not load your flick. Please try again"
        button="Retry"
        handleClick={() => {
          refetch()
        }}
      />
    )

  return flick ? (
    <div className="flex flex-col h-screen">
      <FlickNavBar />
      <FragmentBar />
      <section className="flex h-full">
        <FragmentSideBar />
        <FragmentPreview />
        <FragmentConfiguration />
      </section>
    </div>
  ) : (
    <div />
  )
}

const FragmentPreview = () => {
  return <div className="flex-1">preview</div>
}

const FragmentConfiguration = () => {
  const tabs: Tab[] = [
    {
      name: 'Content',
      value: 'Content',
    },
    {
      name: 'Participants',
      value: 'Participants',
    },
    {
      name: 'Notes',
      value: 'Notes',
    },
  ]
  const [currentTab, setCurrentTab] = useState<Tab>(tabs[1])
  const { activeFragmentId } = useRecoilValue(newFlickStore)

  return (
    <div className="flex flex-col w-3/12 bg-gray-50 h-screen">
      <TabBar
        tabs={tabs}
        current={currentTab}
        onTabChange={setCurrentTab}
        className="flex text-black w-full justify-center mt-6 mb-6"
      />
      {currentTab.value === 'Content' && <FragmentContent />}
      {currentTab.value === 'Participants' && <FragmentParticipants />}
      {currentTab.value === 'Notes' && <Notes fragmentId={activeFragmentId} />}
    </div>
  )
}

const FragmentParticipants = () => {
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)

  const [addParticipantModal, setAddParticipantModal] = useState(false)

  const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)

  return (
    <div className="flex flex-col mx-12">
      {flick?.fragments
        .find((f) => f.id === activeFragmentId)
        ?.participants.map((p) => (
          <div className="flex items-center mt-4">
            <Avatar
              className="w-8 h-8 rounded-full mr-4"
              src={p.participant.user.picture as string}
              alt={p.participant.user.displayName as string}
            />
            <Text>{p.participant.user.displayName}</Text>
          </div>
        ))}
      <div
        className="flex items-center mt-4 cursor-pointer"
        onClick={() => setAddParticipantModal(true)}
      >
        <FiPlus size={32} className="mr-4" />
        <Text className="font-semibold">Invite</Text>
      </div>
      <Modal
        styles={{
          modal: {
            maxWidth: '50%',
            width: '100%',
          },
        }}
        classNames={{ modal: 'rounded-md' }}
        onClose={() => {
          setAddParticipantModal(false)
        }}
        showCloseIcon={false}
        open={addParticipantModal}
        center
      >
        <div className="w-full">
          <Text className="bg-gray-100 text-gray-800 px-4 py-2 rounded-md font-semibold w-max text-sm">
            Invite to {fragment?.name}
          </Text>
        </div>
      </Modal>
    </div>
  )
}

export default FlickNew
