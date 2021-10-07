import React, { useEffect, useState } from 'react'
import { FiPlus } from 'react-icons/fi'
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
import { Notes } from '../Flick/components'
import { CONFIG } from '../Studio/components/Concourse'
import {
  FlickNavBar,
  FragmentBar,
  FragmentContent,
  FragmentSideBar,
  UpdateFragmentParticipantsModal,
} from './components'
import { newFlickStore } from './store/flickNew.store'

const FlickNew = () => {
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
    <div className="flex flex-col h-screen">
      <FlickNavBar />
      <FragmentBar />
      <section className="flex h-full">
        <FragmentSideBar />
        {/* <FragmentPreview /> */}
        <FragmentConfiguration />
      </section>
    </div>
  ) : (
    <div />
  )
}

const FragmentPreview = () => {
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  return (
    <div className="flex-1 flex flex-col items-center mt-6">
      <div className="border-2 w-max">
        <Stage height={CONFIG.height} width={CONFIG.width}>
          <Bridge>
            <Layer>
              <Rect
                x={0}
                y={0}
                height={CONFIG.height}
                width={CONFIG.width}
                fill="#FAFAFA"
              />
            </Layer>
          </Bridge>
        </Stage>
      </div>
    </div>
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
  const { activeFragmentId } = useRecoilValue(newFlickStore)

  return (
    <div className="flex flex-col flex-1 bg-gray-50 h-screen">
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
        onClick={() => setIsAddFragmentParticipantModalOpen(true)}
      >
        <FiPlus size={32} className="mr-4" />
        <Text className="font-semibold">Invite</Text>
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
  )
}

export default FlickNew
