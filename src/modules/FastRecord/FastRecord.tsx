/* eslint-disable no-param-reassign */
/* eslint-disable no-console */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable consistent-return */
import { cx } from '@emotion/css'
import { JSONContent } from '@tiptap/core'
import produce from 'immer'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { Button, emitToast } from '../../components'
import {
  StudioFragmentFragment,
  useMoveOrCopyBlocksMutation,
} from '../../generated/graphql'
import { useQuery } from '../../hooks'
import useDidUpdateEffect from '../../hooks/use-did-update-effect'
import { ViewConfig } from '../../utils/configTypes'
import { EditorContext } from '../Flick/components/EditorProvider'
import { Block, SimpleAST, useUtils } from '../Flick/editor/utils/utils'
import { VideoBlockProps } from '../Presentation/utils/utils'
import FastVideoEditor, {
  Transformations,
  VideoConfig,
} from './FastVideoEditor'

const initalTransformations: Transformations = {
  clip: {
    start: 0,
    end: 0,
    change: 'start',
  },
  crop: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
}

const FastRecord = ({
  blocks,
  dataConfig,
  viewConfig,
  encodedEditorJSON,
  setBlocks,
  setCurrentBlock,
  fragment,
  setFragment,
  handleClose,
}: {
  blocks: VideoBlockProps[]
  viewConfig: ViewConfig
  dataConfig: SimpleAST
  encodedEditorJSON: string
  setBlocks: (blocks: Block[]) => void
  setCurrentBlock: (block: Block) => void
  fragment: StudioFragmentFragment
  setFragment: (fragment: StudioFragmentFragment) => void
  handleClose: () => void
}) => {
  const { url } = (blocks[0] as VideoBlockProps).videoBlock
  const { fragmentId } = useParams<{ fragmentId: string }>()

  const { editor } = useContext(EditorContext) || {}

  const query = useQuery()
  const blockId = query.get('blockId')
  const duration = parseInt(query.get('duration') || '0', 10) / 1000

  const [videosConfigs, setVideosConfigs] = React.useState<VideoConfig[]>(
    blocks.map((b) => {
      return {
        id: b.id,
        start: 0,
        end: duration || 0,
        duration: duration || 0,
        transformations: b.videoBlock.transformations || {
          ...initalTransformations,
          clip: {
            ...initalTransformations.clip,
            start: 0,
            end: duration || 0,
          },
        },
      }
    })
  )
  const [activeVideoConfig, setActiveVideoConfig] = React.useState<VideoConfig>(
    videosConfigs[0]
  )

  useEffect(() => {
    if (!url) return
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = url

    return () => {
      video.remove()
    }
  }, [url])

  const updateVideoConfig = (activeVideoConfig: VideoConfig) => {
    const tempVideoConfig = [...videosConfigs]
    const index = tempVideoConfig.findIndex(
      (video) => video.id === activeVideoConfig.id
    )
    if (index === -1) {
      tempVideoConfig.push(activeVideoConfig)
    } else {
      tempVideoConfig[index] = activeVideoConfig
    }
    setVideosConfigs(tempVideoConfig)
  }

  useEffect(() => {
    if (!activeVideoConfig) return
    console.log('activeVideoConfig', activeVideoConfig)
    updateVideoConfig(activeVideoConfig)
  }, [activeVideoConfig])

  const { getSimpleAST } = useUtils()
  const [updateFragment] = useMoveOrCopyBlocksMutation()
  const [saving, setSaving] = useState(false)

  /* 
    1. Keep track of old block ids
    2. Filter out the blocks that are not in the new list
    3. Remove them from editorJSON, viewConfig
    4. Add the new blocks to editorJSON, viewConfig. Regenerate AST using editorJSON
    5. Update database
    6. Update blocks in the parent component and set the first block as active
  */

  //  1. Keep track of old block ids

  const [initialBlockIds, setInitialBlockIds] = useState(
    blocks.map((b) => b.id)
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      // 2. Filter out the blocks that are not in the new list
      const removedBlockIds = initialBlockIds.filter(
        (id) => !videosConfigs.find((v) => v.id === id)
      )
      const remainingBlocks = blocks.filter(
        (b) => !removedBlockIds.includes(b.id)
      )
      const newBlocks = videosConfigs.filter(
        (v) => !initialBlockIds.find((id) => id === v.id)
      )

      let editorJSON: JSONContent = JSON.parse(
        Buffer.from(encodedEditorJSON, 'base64').toString('utf8')
      )
      let newViewConfig: ViewConfig = { ...viewConfig }

      // 3. Remove them from editorJSON, videoConfig, dataConfig
      // 3.1 Remove from editorJSON
      editorJSON = {
        ...editorJSON,
        content: editorJSON.content?.filter(
          (node) => !removedBlockIds.includes(node.attrs?.id)
        ),
      }
      // 3.2 Remove from viewConfig
      Object.keys(newViewConfig).forEach((key) => {
        if (!removedBlockIds.includes(key)) {
          delete newViewConfig.blocks[key]
        }
      })

      // 4. Add the new blocks to editorJSON, videoConfig, dataConfig
      // 4.1 Add to editorJSON
      console.log(remainingBlocks)
      const lastIndex = editorJSON.content?.findIndex(
        (node) =>
          node.attrs?.id === remainingBlocks[remainingBlocks.length - 1].id
      )
      if (lastIndex !== undefined && lastIndex !== -1 && editorJSON.content) {
        editorJSON.content.splice(
          lastIndex + 1,
          0,
          ...newBlocks.map((b) => {
            return {
              type: 'video',
              attrs: {
                id: b.id,
                src: url,
                caption: null,
                type: 'video',
                associatedBlockId: blockId,
                'data-transformations': JSON.stringify(b.transformations),
              },
              content: [
                {
                  type: 'paragraph',
                  attrs: {
                    id: uuidv4(),
                  },
                },
              ],
            } as JSONContent
          })
        )
      }
      // update transformations of remaining blocks in editorJSON
      editorJSON = produce(editorJSON, (draftState) => {
        draftState.content = draftState.content?.map((node) => {
          if (
            node.attrs?.id &&
            remainingBlocks.find((b) => b.id === node.attrs?.id)
          ) {
            node = produce(node, (draftNode) => {
              if (draftNode.attrs)
                draftNode.attrs['data-transformations'] = JSON.stringify(
                  videosConfigs.find((b) => b.id === node.attrs?.id)
                    ?.transformations
                )
            })
          }
          return node
        })
      })

      // 4.2 Add to viewConfig; Default the layout to the layout of first block
      const viewBlocks = { ...newViewConfig.blocks }
      newBlocks.forEach((b) => {
        viewBlocks[b.id] = {
          layout: viewConfig.blocks[blocks[0].id].layout || 'classic',
          view: {
            type: 'videoBlock',
            video: {
              captionTitleView: 'none',
            },
          },
        }
      })
      newViewConfig = {
        ...newViewConfig,
        blocks: viewBlocks,
      }

      // 4.3 Add to dataConfig; We'll regenerate the dataConfig using new editorJSON
      const newDataConfigWithoutIntroOutro = await getSimpleAST(editorJSON)
      const intro = dataConfig.blocks.find((b) => b.type === 'introBlock')
      const outro = dataConfig.blocks.find((b) => b.type === 'outroBlock')
      const newDataConfig: SimpleAST = {
        blocks: [],
      }
      if (intro) newDataConfig.blocks.push(intro)
      newDataConfig.blocks.push(...newDataConfigWithoutIntroOutro.blocks)
      if (outro)
        newDataConfig.blocks.push({
          ...outro,
          pos: newDataConfigWithoutIntroOutro.blocks.length + 1,
        })

      console.log(
        'OLD VALUES',
        JSON.parse(Buffer.from(encodedEditorJSON, 'base64').toString('utf8')),
        viewConfig,
        dataConfig
      )
      console.log('NEW VALUES', editorJSON, newViewConfig, newDataConfig)

      // 5. Update database
      await updateFragment({
        variables: {
          id: fragmentId,
          configuration: newViewConfig,
          editorState: newDataConfig,
          encodedEditorValue: Buffer.from(JSON.stringify(editorJSON)).toString(
            'base64'
          ),
        },
      })

      // 6. Update blocks in the parent component and set the first block as active
      const allBlocks = [
        ...remainingBlocks.map((b) => b.id),
        ...newBlocks.map((b) => b.id),
      ]
      setInitialBlockIds(allBlocks)
      setBlocks(
        newDataConfigWithoutIntroOutro.blocks.filter((b) =>
          allBlocks.includes(b.id)
        )
      )
      setCurrentBlock(newDataConfigWithoutIntroOutro.blocks[0])
      editor?.commands.setContent(editorJSON)
      setFragment({
        ...fragment,
        configuration: newViewConfig,
        editorState: newDataConfig,
        encodedEditorValue: Buffer.from(JSON.stringify(editorJSON)).toString(
          'base64'
        ),
      })
    } catch (e: any) {
      emitToast({
        title: 'Error Saving',
        type: 'error',
        description: e.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const initialRender = useRef(true)
  useDidUpdateEffect(() => {
    if (initialRender.current) {
      initialRender.current = false
      return
    }
    handleSave()
  }, [videosConfigs])

  return (
    <div className="flex flex-col items-stretch justify-between h-full">
      <div className="flex-1 my-auto flex items-center justify-center w-full">
        {activeVideoConfig && url && (
          <FastVideoEditor
            width={720}
            url={url}
            totalDuration={duration || 0}
            videosConfig={videosConfigs}
            setVideosConfig={setVideosConfigs}
            activeVideoConfig={activeVideoConfig}
            setActiveVideoConfig={setActiveVideoConfig}
            saving={saving}
          />
        )}
      </div>
      <div className="w-full flex justify-start bg-dark-500 p-4 mt-2">
        {videosConfigs.map((videoConfig) => (
          <div
            className={cx('w-24 h-14 bg-dark-300 rounded-md mr-4 border', {
              'border-brand': videoConfig.id === activeVideoConfig?.id,
              'border-transparent': videoConfig.id !== activeVideoConfig?.id,
            })}
            key={videoConfig.id}
            onClick={() => setActiveVideoConfig(videoConfig)}
          />
        ))}
      </div>
    </div>
  )
}

export default FastRecord
