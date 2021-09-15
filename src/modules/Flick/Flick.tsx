import React, { useEffect, useState } from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { FiActivity } from 'react-icons/fi'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  FlickActivity,
  FragmentActivity,
  FragmentConfiguration,
  FragmentsSidebar,
  Participants,
} from './components'
import { currentFlickStore } from '../../stores/flick.store'
import { EmptyState, Heading, ScreenState } from '../../components'
import { useGetFlickByIdQuery } from '../../generated/graphql'
import { studioStore } from '../Studio/stores'
import { User, userState } from '../../stores/user.store'

const Flick = () => {
  const { id, fragmentId } = useParams<{ id: string; fragmentId?: string }>()
  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
  })
  const [flick, setFlick] = useRecoilState(currentFlickStore)
  const [studio, setStudio] = useRecoilState(studioStore)
  const { sub } = (useRecoilValue(userState) as User) || {}

  const [isParticipants, setParticipants] = useState(true)
  const [isActivityMenu, setIsActivityMenu] = useState(false)

  const [activeFragmentId, setActiveFragmentId] = useState<string>()

  const history = useHistory()

  useEffect(() => {
    refetch()
    if (!activeFragmentId || !flick) return
    history.push(`/flick/${flick.id}/${activeFragmentId}`)
  }, [activeFragmentId, flick])

  useEffect(() => {
    if (!data?.Flick_by_pk) return
    setFlick(data.Flick_by_pk)
    if (fragmentId) {
      setActiveFragmentId(fragmentId)
    } else {
      setActiveFragmentId(
        data.Flick_by_pk.fragments.length > 0
          ? data.Flick_by_pk.fragments[0].id
          : undefined
      )
    }
  }, [data])

  useEffect(() => {
    if (!flick) return
    const isHost =
      flick.participants.find(({ userSub }) => userSub === sub)?.owner || false
    setStudio({ ...studio, isHost })
  }, [flick])

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
        handleRefetch={(refresh) => {
          if (refresh) refetch()
        }}
        participants={flick.participants}
      />
      <div className="flex-1 p-4">
        <div className="flex relative mr-4 justify-between">
          <div />
          <Heading className=" flex font-black text-2xl capitalize justify-center mb-2">
            {flick.name}
          </Heading>
          <button
            type="button"
            className="cursor-pointer"
            onClick={() => setIsActivityMenu(!isActivityMenu)}
          >
            <span className="block bg-red-600 absolute w-1.5 h-1.5 rounded-full">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 duration-500 opacity-75" />
            </span>
            <FiActivity />
          </button>
          <FlickActivity menu={isActivityMenu} setMenu={setIsActivityMenu} />
        </div>
        {activeFragmentId ? (
          <div>
            <FragmentActivity
              fragment={flick.fragments.find(
                (fragment) => fragment.id === activeFragmentId
              )}
            />
            <FragmentConfiguration
              fragment={flick.fragments.find(
                (fragment) => fragment.id === activeFragmentId
              )}
              handleRefetch={(refresh) => {
                if (refresh) refetch()
              }}
            />
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
    </section>
  )
}

export default Flick
