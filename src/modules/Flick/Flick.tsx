import { TNode } from '@udecode/plate'
import React, { useEffect, useMemo, useState } from 'react'
import { FiLoader } from 'react-icons/fi'
import { useParams } from 'react-router-dom'
import { useRecoilState, useSetRecoilState } from 'recoil'
import { ScreenState, Text } from '../../components'
import {
  Fragment_Status_Enum_Enum,
  StudioFragmentFragment,
  useGetFlickByIdQuery,
} from '../../generated/graphql'
import { Config } from '../../utils/configTypes'
import studioStore from '../Studio/stores/studio.store'
import {
  FlickNavBar,
  FragmentBar,
  FragmentEditor,
  FragmentSideBar,
  FragmentView,
} from './components'
import { newFlickStore } from './store/flickNew.store'

const useLocalPayload = () => {
  const initialPayload = {
    activeObjectIndex: 0,
    activePointIndex: 0,
    currentIndex: 0,
    currentTime: 3.2065,
    fragmentState: 'customLayout',
    isFocus: false,
    playing: false,
    prevIndex: -1,
    status: Fragment_Status_Enum_Enum.NotStarted,
  }

  const [payload, setPayload] = useState<any>(initialPayload)

  // useEffect(() => {
  //   console.log('payload', payload)
  // }, [payload])

  const updatePayload = (newPayload: any) => {
    setPayload({
      ...payload,
      ...newPayload,
    })
  }

  const resetPayload = () => {
    setPayload(initialPayload)
  }

  return { updatePayload, payload, resetPayload }
}

const Flick = () => {
  const { id, fragmentId } = useParams<{ id: string; fragmentId?: string }>()
  const [{ flick, activeFragmentId, isMarkdown }, setFlickStore] =
    useRecoilState(newFlickStore)
  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
  })
  const setStudio = useSetRecoilState(studioStore)

  const [initialPlateValue, setInitialPlateValue] = useState<TNode<any>[]>()
  const [plateValue, setPlateValue] = useState<TNode<any>[]>()
  const [serializing, setSerializing] = useState(false)

  const [config, setConfig] = useState<Config>({
    dataConfig: [],
    viewConfig: {
      configs: [],
      hasTitleSplash: false,
    },
  })

  const [selectedLayoutId, setSelectedLayoutId] = useState('')

  const { updatePayload, payload, resetPayload } = useLocalPayload()

  useMemo(() => {
    const fragment = flick?.fragments.find(
      (f) => f.id === activeFragmentId
    ) as StudioFragmentFragment
    if (!fragment) return
    setStudio((store) => ({
      ...store,
      payload,
      updatePayload,
      fragment,
    }))
  }, [activeFragmentId, payload])

  useEffect(() => {
    resetPayload()
  }, [activeFragmentId])

  useEffect(() => {
    if (!data) return
    const fragmentsLength = data.Flick_by_pk?.fragments.length || 0
    let activeId = ''
    if (fragmentId) activeId = fragmentId
    else {
      activeId = fragmentsLength > 0 ? data.Flick_by_pk?.fragments[0].id : ''
    }
    setFlickStore((store) => ({
      ...store,
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
    const fragment = flick?.fragments.find(
      (frag) => frag.id === activeFragmentId
    )
    setConfig(
      fragment?.configuration || {
        dataConfig: [],
        viewConfig: {
          configs: [],
          hasTitleSplash: false,
        },
      }
    )
    if (fragment?.configuration) {
      const fragmentConfig = fragment.configuration as Config
      if (fragmentConfig.dataConfig?.length > 0) {
        setSelectedLayoutId(fragmentConfig.dataConfig[0].id)
      }
    }
    setInitialPlateValue(fragment?.editorState)
    setPlateValue(fragment?.editorState)
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
    <div className="h-screen overflow-y-scroll overflow-x-hidden">
      <FlickNavBar />
      <div className="flex h-full">
        <FragmentSideBar />
        {flick.fragments.length > 0 && (
          <div className="w-full">
            <FragmentBar
              initialPlateValue={initialPlateValue}
              setInitialPlateValue={setInitialPlateValue}
              plateValue={plateValue}
              setSerializing={setSerializing}
              config={config}
              setConfig={setConfig}
              setSelectedLayoutId={setSelectedLayoutId}
            />
            {serializing && (
              <div className="flex flex-col gap-y-2 h-full w-full items-center justify-center pb-32">
                <FiLoader size={21} className="animate-spin" />
                <Text className="text-lg">Generating view</Text>
              </div>
            )}
            {!serializing && isMarkdown === true && (
              <FragmentEditor value={plateValue} setValue={setPlateValue} />
            )}
            {!serializing && isMarkdown === false && (
              <FragmentView
                config={config}
                setConfig={setConfig}
                selectedLayoutId={selectedLayoutId}
                setSelectedLayoutId={setSelectedLayoutId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  ) : (
    <div />
  )
}

export default Flick
