/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */ import React, {
  useEffect,
  useState,
} from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { FiActivity } from 'react-icons/fi'
import { FaPlus } from 'react-icons/fa'
import { useRecoilState, useRecoilValue } from 'recoil'
import { BiChevronLeft } from 'react-icons/bi'
import {
  FlickActivity,
  FlickSideBar,
  FragmentActivity,
  FragmentConfiguration,
  FragmentsSidebar,
} from './components'
import { currentFlickStore } from '../../stores/flick.store'
import {
  Button,
  EmptyState,
  Heading,
  ScreenState,
  Text,
} from '../../components'
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
    <div>
      <div className="flex bg-gray-50 p-2 m-1 justify-between pr-8">
        <div
          className="cursor-pointer hover:underline flex items-center"
          onClick={() => history.push('/dashboard')}
        >
          <BiChevronLeft />
          <Text className="text-xs">Back to dashboard</Text>
        </div>
        <Heading className=" flex font-black text-2xl capitalize justify-center -ml-20">
          {flick.name}
        </Heading>
        <button
          type="button"
          className="cursor-pointer"
          onClick={() => setIsActivityMenu(!isActivityMenu)}
        >
          <FiActivity />
        </button>
        <FlickActivity menu={isActivityMenu} setMenu={setIsActivityMenu} />
      </div>
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
          {activeFragmentId && (
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
          )}
          {flick.fragments.length === 0 && (
            <div className="flex h-full w-full items-center justify-center">
              <Button
                appearance="primary"
                className=""
                type="button"
                icon={FaPlus}
                size="large"
                onClick={() => {
                  history.push(`/new-fragment/${flick.id}`)
                }}
              >
                Create Fragment
              </Button>
            </div>
          )}
          {!activeFragmentId && (
            <>
              <EmptyState text="No Fragment is selected" width={400} />
            </>
          )}
        </div>
        <FlickSideBar
          fragment={flick.fragments.find(
            (fragment) => fragment.id === activeFragmentId
          )}
          handleRefetch={(refresh) => {
            if (refresh) refetch()
          }}
        />
      </section>
    </div>
  )
}

export default Flick
