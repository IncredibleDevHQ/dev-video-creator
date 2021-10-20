import React, { useEffect, useState } from 'react'
import { FiPlus, FiPlusCircle } from 'react-icons/fi'
import { Layer, Rect, Stage } from 'react-konva'
import Modal from 'react-responsive-modal'
import { useParams } from 'react-router'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilState,
  useRecoilValue,
} from 'recoil'
import {
  Avatar,
  emitToast,
  ScreenState,
  Tab,
  TabBar,
  Text,
} from '../../components'
import {
  useGetFlickByIdQuery,
  useGetFragmentParticipantsLazyQuery,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import { Notes } from './components'
import { CONFIG } from '../Studio/components/Concourse'
import {
  FlickNavBar,
  FragmentBar,
  FragmentContent,
  FragmentSideBar,
  UpdateFragmentParticipantsModal,
} from './components'
import { newFlickStore } from './store/flickNew.store'

//reworked config page
const Flick = () => {
  const { id, fragmentId } = useParams<{ id: string; fragmentId?: string }>()
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
  })

  useEffect(() => {
    if (!fragmentId) return
    else
      setFlickStore((store) => ({
        ...store,
        activeFragmentId: fragmentId,
      }))
  }, [fragmentId])

  useEffect(() => {
    if (!data) return
    const fragmentsLength = data.Flick_by_pk?.fragments.length || 0
    let activeId = ''
    if (fragmentId) activeId = fragmentId
    else {
      activeId = fragmentsLength > 0 ? data.Flick_by_pk?.fragments[0].id : ''
    }
    setFlickStore(() => ({
      flick: data.Flick_by_pk || null,
      activeFragmentId: activeId,
    }))
  }, [data])

  useEffect(() => {
    if (!activeFragmentId || !flick) return
    window.history.replaceState(
      null,
      'Incredible.dev',
      `/flick/${flick.id}/${activeFragmentId}`
    )
  }, [activeFragmentId])

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
    <div className="h-screen overflow-hidden">
      <FlickNavBar />
      <div className="flex h-full">
        <FragmentSideBar />
        <div className="w-full">
          <FragmentBar />
          <FragmentConfiguration />
        </div>
      </div>
    </div>
  ) : (
    <div />
  )
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
  const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])
  const { activeFragmentId, flick } = useRecoilValue(newFlickStore)

  const fragment = flick?.fragments.find((frag) => frag.id === activeFragmentId)
  const { sub } = (useRecoilValue(userState) as User) || {}

  return flick && fragment ? (
    <div className="flex h-screen relative">
      <FragmentContent />
      <FragmentParticipants />
      {/* <TabBar
        tabs={tabs}
        current={currentTab}
        onTabChange={setCurrentTab}
        className="flex text-black w-full justify-center mt-6 mb-6"
      /> */}
      {/* {currentTab.value === 'Content' && <FragmentContent />} */}
      {/* {currentTab.value === 'Participants' && <FragmentParticipants />} */}
      {/* {currentTab.value === 'Notes' && (
        <div className="p-4">
          <Notes
            flickId={flick.id}
            participantId={
              fragment.participants.find(
                ({ participant }) => participant.userSub === sub
              )?.participant.id
            }
          />
        </div>
      )} */}
    </div>
  ) : (
    <div />
  )
}

const FragmentParticipants = () => {
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)

  const [
    isAddFragmentParticipantModalOpen,
    setIsAddFragmentParticipantModalOpen,
  ] = useState(false)

  const [GetFragmentParticipants, { data, error }] =
    useGetFragmentParticipantsLazyQuery({
      variables: {
        fragmentId: activeFragmentId,
      },
    })

  useEffect(() => {
    if (!data || !flick) return
    const updatedFragments = flick.fragments.map((fragment) => {
      if (fragment.id === activeFragmentId) {
        return {
          ...fragment,
          participants: data.Fragment_Participant,
        }
      } else return fragment
    })
    setFlickStore((store) => ({
      ...store,
      flick: {
        ...flick,
        fragments: updatedFragments,
      },
      activeFragmentId: store.activeFragmentId,
    }))
  }, [data])

  useEffect(() => {
    if (!error) return
    emitToast({
      title: 'Could not fetch updated participants',
      type: 'error',
      description: `Click this toast to give it another try.`,
      onClick: () => GetFragmentParticipants(),
    })
  }, [error])

  return (
    <div>
      <div className="flex flex-col items-center bg-gray-100 border-2 border-gray-300 px-1.5 w-min py-2 rounded-md ml-4 mr-4 mt-4">
        {flick?.fragments
          .find((f) => f.id === activeFragmentId)
          ?.participants.map((p) => (
            <Avatar
              className="w-8 h-8 rounded-full"
              src={p.participant.user.picture as string}
              alt={p.participant.user.displayName as string}
            />
          ))}
        <div
          className="flex items-center mt-4 cursor-pointer"
          onClick={() => setIsAddFragmentParticipantModalOpen(true)}
        >
          <FiPlusCircle size={32} className="" />
        </div>
        <UpdateFragmentParticipantsModal
          key={`modal-${activeFragmentId}`}
          open={isAddFragmentParticipantModalOpen}
          handleClose={(refresh) => {
            setIsAddFragmentParticipantModalOpen(false)
            if (refresh) {
              GetFragmentParticipants()
            }
          }}
        />
      </div>
    </div>
  )
}

export default Flick
