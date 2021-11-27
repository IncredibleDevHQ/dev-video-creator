import React, { useEffect, useMemo, useState } from 'react'
import { useHistory, useParams } from 'react-router-dom'
import { useRecoilState, useSetRecoilState } from 'recoil'
import { ScreenState, TextEditor } from '../../components'
import {
  Fragment_Status_Enum_Enum,
  StudioFragmentFragment,
  useGetFlickByIdQuery,
  UserAssetQuery,
  useUserAssetQuery,
} from '../../generated/graphql'
import { Config } from '../../utils/configTypes'
import studioStore from '../Studio/stores/studio.store'
import {
  FlickNavBar,
  FragmentBar,
  FragmentSideBar,
  PublishModal,
} from './components'
import { newFlickStore } from './store/flickNew.store'
import { initEditor } from '../../utils/plateConfig/serializer/values'
import BlockPreview, {
  getGradientConfig,
  gradients,
} from './components/BlockPreview'
import { Block } from '../../components/TextEditor/utils'
import { BlockProperties, ViewConfig } from '../../utils/configTypes2'
import { useCanvasRecorder } from '../../hooks'

const useLocalPayload = () => {
  const initialPayload = {
    activeObjectIndex: 0,
    activePointIndex: 0,
    currentIndex: 0,
    currentTime: 0,
    fragmentState: 'customLayout',
    isFocus: false,
    playing: false,
    prevIndex: -1,
    status: Fragment_Status_Enum_Enum.NotStarted,
  }

  const [payload, setPayload] = useState<any>()

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
  const initialConfig: Config = {
    dataConfig: [],
    viewConfig: {
      configs: [],
      titleSplashConfig: {
        cssString:
          'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
        values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
        startIndex: {
          x: 0,
          y: 269.99999999999994,
        },
        endIndex: {
          x: 960,
          y: 270.00000000000006,
        },
      },
      hasTitleSplash: true,
    },
  }

  const { id, fragmentId } = useParams<{ id: string; fragmentId?: string }>()
  const [{ flick, activeFragmentId, isMarkdown }, setFlickStore] =
    useRecoilState(newFlickStore)
  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
  })
  const setStudio = useSetRecoilState(studioStore)
  const history = useHistory()

  const [currentBlock, setCurrentBlock] = useState<Block>()
  const [viewConfig, setViewConfig] = useState<ViewConfig>({
    mode: 'Landscape',
    blocks: {},
  })

  const [initialPlateValue, setInitialPlateValue] = useState<any>()
  const [plateValue, setPlateValue] = useState<any>()
  const [serializing, setSerializing] = useState(false)
  const [integrationModal, setIntegrationModal] = useState(false)

  const [config, setConfig] = useState<Config>(initialConfig)

  const [selectedLayoutId, setSelectedLayoutId] = useState('')

  const { updatePayload, payload, resetPayload } = useLocalPayload()
  const [myMediaAssets, setMyMediaAssets] = useState<UserAssetQuery>()
  const {
    data: assetsData,
    error: assetsError,
    refetch: assetsRefetch,
  } = useUserAssetQuery()

  const { addTransitionAudio } = useCanvasRecorder({ options: {} })

  const updateBlockProperties = (id: string, properties: BlockProperties) => {
    const newBlocks = { ...viewConfig.blocks, [id]: properties }
    setViewConfig({ ...viewConfig, blocks: newBlocks })
  }

  useEffect(() => {
    if (!currentBlock) return
    if (!viewConfig.blocks[currentBlock.id]) {
      const newBlocks = { ...viewConfig.blocks }
      newBlocks[currentBlock.id] = {
        layout: 'classic',
        gradient: getGradientConfig(gradients[0]),
      }
      setViewConfig({ ...viewConfig, blocks: newBlocks })
    }
  }, [currentBlock])

  useEffect(() => {
    if (!assetsData) return
    setMyMediaAssets(assetsData)
  }, [assetsData])

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
      addTransitionAudio,
    }))
  }, [activeFragmentId, payload])

  useEffect(() => {
    resetPayload()
    setStudio((store) => ({
      ...store,
      shortsMode: false,
    }))
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
    return () => {
      setFlickStore({
        flick: null,
        activeFragmentId: '',
        isMarkdown: true,
      })
    }
  }, [])

  useEffect(() => {
    if (!activeFragmentId || !flick) return
    history.replace(`/flick/${flick.id}/${activeFragmentId}`)
    const fragment = flick?.fragments.find(
      (frag) => frag.id === activeFragmentId
    )
    setConfig(fragment?.configuration || initialConfig)
    setInitialPlateValue(fragment?.editorState)
    setPlateValue(fragment?.editorState || initEditor)
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

  if (!flick) return null
  if (assetsError) {
    return (
      <ScreenState
        title="Something went wrong!"
        subtitle={assetsError.message}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <div>
        <FlickNavBar toggleModal={setIntegrationModal} />
        <FragmentBar
          initialPlateValue={initialPlateValue}
          setInitialPlateValue={setInitialPlateValue}
          plateValue={plateValue}
          setSerializing={setSerializing}
          config={config}
          setConfig={setConfig}
          setSelectedLayoutId={setSelectedLayoutId}
          assetsData={myMediaAssets}
        />
      </div>
      <div className="flex flex-1 overflow-y-auto">
        <FragmentSideBar />
        {flick.fragments.length > 0 && (
          <div className="px-8 w-full overflow-y-scroll pb-8 flex justify-between items-start">
            <TextEditor
              placeholder="Start writing..."
              handleUpdateJSON={(json) => {
                setPlateValue(json)
              }}
              initialContent={initialPlateValue}
              handleActiveBlock={(block) => {
                console.log('active block!', block)
                setCurrentBlock(block)
              }}
            />
            <div className="w-48 pt-20">
              {currentBlock && (
                <BlockPreview
                  config={viewConfig}
                  block={currentBlock}
                  updateConfig={updateBlockProperties}
                />
              )}
            </div>
          </div>
        )}
      </div>
      <PublishModal
        flickId={flick.id}
        open={integrationModal}
        handleClose={() => setIntegrationModal(false)}
      />
      {/* Below div is necessary to allow scroll in the above div */}
      <div />
    </div>
  )
}

export default Flick
