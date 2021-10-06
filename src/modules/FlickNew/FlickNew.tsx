import React, { useEffect, useState } from 'react'
import { BsCameraVideo } from 'react-icons/bs'
import {
  FiBell,
  FiChevronLeft,
  FiCopy,
  FiDelete,
  FiTrash,
  FiUpload,
} from 'react-icons/fi'
import { IoCopyOutline, IoTrashOutline } from 'react-icons/io5'
import { useHistory, useParams } from 'react-router'
import { Link } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { Heading, Button, ScreenState, emitToast } from '../../components'
import { ASSETS } from '../../constants'
import {
  useGetFlickByIdQuery,
  useGetFlickFragmentsLazyQuery,
} from '../../generated/graphql'
import { FlickActivity } from '../Flick/components'
import {
  DeleteFragmentModal,
  DuplicateFragmentModal,
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

const FlickNavBar = () => {
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const [isActivityMenu, setIsActivityMenu] = useState(false)

  return (
    <div className="flex justify-between items-center pr-6 pl-3 py-3">
      <div className="flex items-center">
        <Link to="/dashboard">
          <div className="flex">
            <FiChevronLeft size={32} className="text-gray-700 mr-2" />
            <img src={ASSETS.ICONS.StudioLogo} alt="" className="w-32" />
          </div>
        </Link>
        <Heading className="font-semibold ml-12">{flick?.name}</Heading>
      </div>
      <div className="flex items-center">
        <FiBell
          className="text-gray-600 mr-8 cursor-pointer"
          size={24}
          onClick={() => setIsActivityMenu(!isActivityMenu)}
        />
        <Button appearance="primary" size="small" icon={FiUpload} type="button">
          Publish
        </Button>
      </div>
      <div className="absolute right-0">
        <FlickActivity menu={isActivityMenu} setMenu={setIsActivityMenu} />
      </div>
    </div>
  )
}

const FragmentBar = () => {
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(false)
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)

  const [GetFlickFragments, { data, error, refetch }] =
    useGetFlickFragmentsLazyQuery({
      variables: {
        flickId: flick?.id,
      },
    })

  useEffect(() => {
    if (!data || !flick) return
    setFlickStore((store) => ({
      ...store,
      flick: {
        ...flick,
        fragments: [...data.Fragment],
      },
    }))
  }, [data])

  useEffect(() => {
    if (!error || !refetch) return
    emitToast({
      title: "We couldn't fetch your new fragment",
      type: 'error',
      description: 'Click this toast to give it another try',
      onClick: () => refetch(),
    })
  }, [error])

  return (
    <div className="flex items-center bg-gray-50 justify-between pr-6 pl-3 py-2 border-t border-b border-gray-300">
      <div className="flex">
        <IoTrashOutline
          size={24}
          className="mr-8 ml-2 text-gray-600 cursor-pointer"
          onClick={() => setConfirmDeleteModal(true)}
        />
        <IoCopyOutline
          size={24}
          className="text-gray-600 cursor-pointer"
          onClick={() => setDuplicateModal(true)}
        />
      </div>
      <Button
        appearance="secondary"
        size="small"
        icon={BsCameraVideo}
        type="button"
      >
        Record
      </Button>
      <DeleteFragmentModal
        open={confirmDeleteModal}
        handleClose={() => {
          setConfirmDeleteModal(false)
        }}
      />
      <DuplicateFragmentModal
        open={duplicateModal}
        handleClose={(refresh) => {
          if (refresh) {
            GetFlickFragments()
          }
          setDuplicateModal(false)
        }}
      />
    </div>
  )
}

const FragmentPreview = () => {
  return <div>preview</div>
}

const FragmentConfiguration = () => {
  return <div>configuration</div>
}

export default FlickNew
