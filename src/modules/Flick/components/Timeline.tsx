import { cx } from '@emotion/css'
import * as Sentry from '@sentry/react'
import { JSONContent } from '@tiptap/core'
import { sentenceCase } from 'change-case'
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { FiArrowUpRight } from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi'
import {
  IoCloseOutline,
  IoCopyOutline,
  IoMenuOutline,
  IoPlay,
  IoPlayOutline,
} from 'react-icons/io5'
import { MdOutlinePresentToAll } from 'react-icons/md'
import { useRecoilState, useRecoilValue } from 'recoil'
import { v4 as uuidv4 } from 'uuid'
import { ReactComponent as CommandCodeSandbox } from '../../../assets/Command_CodeSandbox.svg'
import { ReactComponent as CommandReplit } from '../../../assets/Command_Replit.svg'
import { ReactComponent as CommandStackBlitz } from '../../../assets/Command_Stackblitz.svg'
import { ReactComponent as UserPlaceholder } from '../../../assets/StudioUser.svg'
import { ReactComponent as TimelineIcon } from '../../../assets/Timeline.svg'
import { Button, emitToast, Text, Tooltip } from '../../../components'
import {
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  useMoveOrCopyBlocksMutation,
} from '../../../generated/graphql'
import { logEvent } from '../../../utils/analytics'
import { PageEvent } from '../../../utils/analytics-types'
import {
  BlockProperties,
  IntroBlockView,
  OutroBlockView,
  ViewConfig,
} from '../../../utils/configTypes'
import { horizontalCustomScrollBar } from '../../../utils/globalStyles'
import { studioStore } from '../../Studio/stores'
import { Block, SimpleAST, useUtils } from '../editor/utils/utils'
import { newFlickStore, View } from '../store/flickNew.store'
import { EditorContext } from './EditorProvider'
import { FragmentTypeIcon } from './LayoutGeneric'
import ViewRecordingsModal from './ViewRecordingsModal'

const CopyMoveActions = ({
  action,
  selectedBlockIds,
  setSelectedBlockIds,
}: {
  action: 'copy' | 'move'
  selectedBlockIds: string[]
  setSelectedBlockIds: React.Dispatch<React.SetStateAction<string[]>>
}) => {
  const [{ flick, activeFragmentId }, setStore] = useRecoilState(newFlickStore)

  const { editor } = useContext(EditorContext) || {}

  const { getSimpleAST } = useUtils()

  const [updateTargetFragment] = useMoveOrCopyBlocksMutation()

  /* 
  1. Get the current and target fragments
  2. Get JSONs of current document
  3. Get JSONs of target document
  4. We return undefined from getEditorContent if the editor value is not in json format
  5. Copy/Move nodes from the editor using its JSON
  6. Copy/Move the view configuration of the selected blocks
  7. Copy/Move the simpleAST of the selected blocks
  8. Initialize the new target fragment
  9. Update the new target fragment
  10. Store the new target fragment
  11. Modify the current editor content
  */

  const getEditorContent = (fragmentId: string): JSONContent | undefined => {
    const ev = flick?.fragments.find((fragment) => fragment.id === fragmentId)
      ?.encodedEditorValue
      ? Buffer.from(
          flick?.fragments.find((fragment) => fragment.id === fragmentId)
            ?.encodedEditorValue as string,
          'base64'
        ).toString('utf8')
      : ''
    // detect if stored editor value is in html or json format
    if (ev.startsWith('<') || ev === '') {
      return undefined
    }
    return JSON.parse(ev)
  }

  const handleCopyOrMove = async (targetFragmentId: string) => {
    try {
      // 1. Get the current and target fragments
      const currentFragment = flick?.fragments.find(
        (f) => f.id === activeFragmentId
      )
      const targetFragment = flick?.fragments.find(
        (f) => f.id === targetFragmentId
      )
      if (!currentFragment || !targetFragment) return

      // 2. Get JSONs of current document
      const currentSimpleAST: SimpleAST = currentFragment?.editorState || {
        blocks: [],
      }
      const currentViewConfiguration: ViewConfig =
        currentFragment?.configuration || {}
      const currentEditorContent = getEditorContent(activeFragmentId)

      // 3. Get JSONs of target document
      const targetSimpleAST: SimpleAST = targetFragment?.editorState || {
        blocks: [],
      }
      const targetViewConfiguration: ViewConfig =
        targetFragment?.configuration || {}
      const targetEditorContent = getEditorContent(targetFragmentId)

      // 4. We return undefined from getEditorContent if the editor value is not in json format
      if (
        currentEditorContent === undefined ||
        targetEditorContent === undefined
      ) {
        emitToast({
          type: 'error',
          autoClose: 5000,
          title: 'Error performing action',
          description:
            'One of the stories is not compatible with this action. Updating the story contents may help.',
        })
        return
      }

      const blocksToOperate = currentSimpleAST.blocks.filter((block) =>
        selectedBlockIds.includes(block.id)
      )

      // 5. Copy/Move nodes from the editor using its JSON
      const selectedEditorContent: JSONContent[] = []
      let remainingEditorContent: JSONContent[] = []
      blocksToOperate.forEach((block) => {
        currentEditorContent.content?.forEach((c) => {
          if (![...(block.nodeIds || []), block.id]?.includes(c.attrs?.id)) {
            remainingEditorContent.push(c)
          } else {
            selectedEditorContent.push({
              ...c,
              attrs: c.attrs
                ? {
                    ...c.attrs,
                    id: uuidv4(),
                  }
                : c.attrs,
            })
            remainingEditorContent = remainingEditorContent.filter(
              (rec) => c.attrs?.id === rec.attrs?.id
            )
          }
        })
      })
      const newTargetEditorContent: JSONContent = {
        ...targetEditorContent,
        content: [
          ...(targetEditorContent.content || []),
          ...selectedEditorContent,
        ],
      }
      const newEncodedTargetEditorContent = Buffer.from(
        JSON.stringify(newTargetEditorContent)
      ).toString('base64')

      // 6. Copy/Move the view configuration of the selected blocks
      const selectedBlockProperties: {
        [x: string]: BlockProperties
      } = {}
      const remainingBlockProperties: {
        [x: string]: BlockProperties
      } = {}
      if (currentViewConfiguration?.blocks) {
        Object.entries(currentViewConfiguration.blocks).forEach(
          ([id, entry]) => {
            if (selectedBlockIds.includes(id)) {
              selectedBlockProperties[id] = entry
            } else {
              remainingBlockProperties[id] = entry
            }
          }
        )
      }

      // 7. Copy/Move the simpleAST of the selected blocks
      const newTargetSimpleASTWithoutIntroOutro = await getSimpleAST(
        newTargetEditorContent
      )
      const intro = targetSimpleAST.blocks.find((b) => b.type === 'introBlock')
      const outro = targetSimpleAST.blocks.find((b) => b.type === 'outroBlock')
      const newTargetSimpleAST: SimpleAST = {
        blocks: [],
      }
      if (intro) newTargetSimpleAST.blocks.push(intro)
      newTargetSimpleAST.blocks.push(
        ...newTargetSimpleASTWithoutIntroOutro.blocks
      )
      if (outro)
        newTargetSimpleAST.blocks.push({
          ...outro,
          pos: newTargetSimpleASTWithoutIntroOutro.blocks.length + 1,
        })

      // 8. Initialize the new target fragment
      const newTargetFragment: FlickFragmentFragment = {
        ...targetFragment,
        editorState: newTargetSimpleAST,
        encodedEditorValue: newEncodedTargetEditorContent,
        configuration: {
          ...targetViewConfiguration,
          blocks: {
            ...(targetViewConfiguration?.blocks || {}),
            ...selectedBlockProperties,
          },
        },
      }
      // console.log(
      //   'newTargetConfig',
      //   targetFragment.configuration,
      //   newTargetFragment.configuration
      // )
      // console.log(
      //   'newTargetAST',
      //   newTargetSimpleAST,
      //   targetFragment.editorState
      // )

      // 9. Update the new target fragment
      await updateTargetFragment({
        variables: {
          id: targetFragmentId,
          configuration: newTargetFragment.configuration,
          editorState: newTargetSimpleAST,
          encodedEditorValue: newEncodedTargetEditorContent,
        },
      })

      // 10. Store the new target fragment
      if (flick) {
        setStore((prev) => ({
          ...prev,
          flick: {
            ...flick,
            fragments: flick.fragments.map((fragment) => {
              if (fragment.id === targetFragmentId) {
                return newTargetFragment
              }
              return fragment
            }),
          },
        }))
      }

      // 11. Modify the current editor content
      if (action === 'move') {
        editor?.commands.setContent(remainingEditorContent, true)
      }

      emitToast({
        type: 'success',
        autoClose: 1500,
        title: `${action === 'copy' ? 'Copied' : 'Moved'} ${
          blocksToOperate.length
        } block${blocksToOperate.length > 1 ? 's' : ''}`,
      })

      setSelectedBlockIds([])
    } catch (e) {
      Sentry.captureException(`Failed to ${action} ====>  ${e}`)
      emitToast({
        type: 'error',
        autoClose: 5000,
        title: 'Error performing action',
        description: 'Something went wrong',
      })
    }
  }

  return (
    <div
      style={{
        minWidth: '200px',
        zIndex: 9999,
      }}
      className="bg-dark-300 p-1 rounded-sm text-gray-50 font-body pb-2"
    >
      <Text className="font-bold font-main text-xs pl-3 my-1.5">
        {sentenceCase(action)} to
      </Text>
      {flick?.fragments
        ?.filter((f) => f.id !== activeFragmentId)
        ?.map(({ type, id, name }) => {
          return (
            <button
              type="button"
              className={cx(
                'flex rounded-sm items-center gap-x-2 py-1.5 px-3 hover:bg-dark-100 active:bg-dark-300 w-full'
              )}
              onClick={(e) => {
                e.stopPropagation()
                handleCopyOrMove(id)
              }}
            >
              {(() => {
                switch (type) {
                  case Fragment_Type_Enum_Enum.Landscape:
                    return <IoPlayOutline />
                  case Fragment_Type_Enum_Enum.Portrait:
                    return <HiOutlineSparkles />
                  case Fragment_Type_Enum_Enum.Blog:
                    return <IoMenuOutline />
                  case Fragment_Type_Enum_Enum.Presentation:
                    return <MdOutlinePresentToAll />
                  default:
                    return null
                }
              })()}
              <Text className="text-xs">{name}</Text>
            </button>
          )
        })}
    </div>
  )
}

const BlockActions = ({
  selectedBlockIds,
  setSelectedBlockIds,
}: {
  selectedBlockIds: string[]
  setSelectedBlockIds: React.Dispatch<React.SetStateAction<string[]>>
}) => {
  const [isCopying, setIsCopying] = useState(false)
  const [isMoving, setIsMoving] = useState(false)

  return (
    <div className="flex items-center gap-x-2">
      <Tooltip
        content={
          <div className="ml-2">
            <CopyMoveActions
              action="copy"
              selectedBlockIds={selectedBlockIds}
              setSelectedBlockIds={setSelectedBlockIds}
            />
          </div>
        }
        isOpen={isCopying}
        setIsOpen={setIsCopying}
        placement="top-start"
      >
        <Button
          appearance="gray"
          type="button"
          size="small"
          className={cx(
            'flex items-center ml-2 my-2 hover:bg-gray-700 bg-dark-500 max-w-max py-1.5'
          )}
          onClick={() => {
            setIsCopying(true)
          }}
        >
          <IoCopyOutline className="mr-2" />
          <Text className="text-sm">Copy Selected</Text>
        </Button>
      </Tooltip>
      <Tooltip
        content={
          <CopyMoveActions
            action="move"
            selectedBlockIds={selectedBlockIds}
            setSelectedBlockIds={setSelectedBlockIds}
          />
        }
        isOpen={isMoving}
        setIsOpen={setIsMoving}
        placement="top-start"
      >
        <Button
          appearance="gray"
          type="button"
          size="small"
          className={cx(
            'flex items-center my-2 hover:bg-gray-700 bg-dark-500 max-w-max py-1.5'
          )}
          onClick={() => {
            setIsMoving(true)
          }}
        >
          <FiArrowUpRight className="mr-2" />
          <Text className="text-sm">Move Selected</Text>
        </Button>
      </Tooltip>
      <button
        type="button"
        className={cx(
          'flex items-center hover:bg-gray-700 bg-dark-500 max-w-max p-2.5 text-white rounded-md'
        )}
        onClick={() => {
          setSelectedBlockIds([])
        }}
      >
        <IoCloseOutline />
      </button>
    </div>
  )
}

const Timeline = ({
  blocks,
  currentBlock,
  setCurrentBlock,
  persistentTimeline = false,
  shouldScrollToCurrentBlock = true,
  showTimeline,
  config,
  setShowTimeline,
  setConfig,
}: {
  blocks: Block[]
  currentBlock: Block | undefined
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
  persistentTimeline: boolean
  shouldScrollToCurrentBlock: boolean
  showTimeline: boolean
  config: ViewConfig
  setShowTimeline: React.Dispatch<React.SetStateAction<boolean>>
  setConfig?: (config: ViewConfig) => void
}) => {
  const { payload, updatePayload } = useRecoilValue(studioStore)
  const timeline = useRef<HTMLDivElement>(null)

  const { view, flick, activeFragmentId } = useRecoilValue(newFlickStore)

  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([])

  const [viewRecordingModal, setViewRecordingModal] = useState(false)
  const [blockId, setBlockId] = useState('')

  const activeFragment = flick?.fragments.find((f) => f.id === activeFragmentId)

  const recordedBlockIds = useMemo(() => {
    const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)
    const blocks = fragment?.blocks || []
    return blocks.map((b) => b.id)
  }, [activeFragmentId])

  useEffect(() => {
    setShowTimeline(persistentTimeline)
  }, [])

  useEffect(() => {
    if (persistentTimeline) {
      setShowTimeline(true)
    } else if (view === View.Preview) {
      setShowTimeline(true)
    } else {
      setShowTimeline(false)
    }
  }, [persistentTimeline, view])

  const checkInBetween = (start: number, end: number) => {
    // check if all blocks in between are of type interaction
    const inBetween = blocks.slice(start + 1, end)

    if (inBetween.length === 0) return false

    const isTrue = inBetween.every((b) => {
      return b.type === 'interactionBlock'
    })

    return isTrue
  }

  const handleBlockSelect = (
    blockId: string,
    action: 'added' | 'removed',
    timelineIndex: number
  ) => {
    console.log('handleBlockSelect', blockId, action, timelineIndex)
    if (action === 'added') {
      if (config.selectedBlocks?.length > 0) {
        const currentBlockIndex = blocks.findIndex(
          (block) => block.id === blockId
        )
        console.log('currentBlockIndex', currentBlockIndex)
        console.log(config.selectedBlocks[0].pos)
        if (config.selectedBlocks[0].pos - 1 === currentBlockIndex) {
          console.log('Adding to front')
          setConfig?.({
            ...config,
            selectedBlocks: [
              { blockId, pos: timelineIndex },
              ...config.selectedBlocks,
            ],
          })
        } else if (
          config.selectedBlocks[config.selectedBlocks.length - 1].pos + 1 ===
          currentBlockIndex
        ) {
          console.log('Adding to back')
          setConfig?.({
            ...config,
            selectedBlocks: [
              ...config.selectedBlocks,
              { blockId, pos: timelineIndex },
            ],
          })
        } else if (
          checkInBetween(config.selectedBlocks[0].pos, currentBlockIndex) ||
          checkInBetween(currentBlockIndex, config.selectedBlocks[0].pos)
        ) {
          console.log('Adding in between')
          setConfig?.({
            ...config,
            selectedBlocks: [
              ...config.selectedBlocks,
              { blockId, pos: timelineIndex },
            ],
          })
        } else {
          console.log('Invalid pos on timeline to add new block')
          emitToast({
            type: 'info',
            title: "You can't select this block!",
            description: 'You can only select blocks adjacent to each other',
          })
        }
      } else {
        // Adding the first block
        setConfig?.({
          ...config,
          selectedBlocks: [{ blockId, pos: timelineIndex }],
        })
      }
    }
    if (action === 'removed') {
      const index = config.selectedBlocks.findIndex(
        (b) => b.blockId === blockId
      )
      const newSelectedBlocks = config.selectedBlocks?.slice(0, index)
      setConfig?.({
        ...config,
        selectedBlocks: newSelectedBlocks,
      })
    }
  }

  return (
    <div
      className={cx('absolute flex flex-col bottom-0 left-0 w-full z-40', {
        relative: persistentTimeline,
      })}
    >
      {!persistentTimeline && selectedBlockIds.length === 0 && (
        <div className="flex items-center">
          <Button
            appearance="gray"
            type="button"
            size="small"
            className={cx(
              'flex items-center ml-4 mr-2 my-2 hover:bg-gray-700 bg-dark-500 max-w-max'
            )}
            onClick={() => {
              // Segment Tracking
              logEvent(
                showTimeline ? PageEvent.OpenTimeLine : PageEvent.CloseTimeLine
              )
              setShowTimeline(!showTimeline)

              // if (showTimeline === false) {
              //   setBlockSelectMode(false)
              // }
            }}
          >
            <TimelineIcon className="w-6 h-6 mr-1" />
            <Text className="text-sm">
              {showTimeline ? 'Close timeline' : 'Open timeline'}
            </Text>
          </Button>
          {showTimeline &&
            activeFragment?.type !== Fragment_Type_Enum_Enum.Presentation && (
              <Button
                appearance="gray"
                type="button"
                size="small"
                className={cx(
                  'flex items-center ml-2 my-2 hover:bg-gray-700 bg-dark-500 max-w-max'
                )}
                onClick={() => {
                  setConfig?.({
                    ...config,
                    continuousRecording: !config.continuousRecording,
                    selectedBlocks: config.continuousRecording
                      ? config.selectedBlocks
                      : [],
                  })
                }}
              >
                <Text
                  style={{
                    marginTop: '2px',
                    marginBottom: '2px',
                  }}
                  className="text-sm"
                >
                  {config.continuousRecording
                    ? 'Block Recording'
                    : 'Continuous Recording (Experimental)'}
                </Text>
              </Button>
            )}
        </div>
      )}

      {showTimeline && selectedBlockIds.length > 0 && (
        <BlockActions
          selectedBlockIds={selectedBlockIds}
          setSelectedBlockIds={setSelectedBlockIds}
        />
      )}

      {showTimeline && (
        <div className="flex">
          <div className="h-24" />
          <div
            ref={timeline}
            className={cx(
              'flex items-center w-full bg-dark-500 py-4 gap-x-4 overflow-x-auto',
              horizontalCustomScrollBar
            )}
          >
            {blocks.map((block: Block, index) => (
              <a
                className={cx(
                  'group flex items-center gap-x-3 border border-transparent cursor-pointer relative',
                  {
                    'bg-dark-300 py-1.5 px-2 rounded-md':
                      block.type === 'introBlock' ||
                      block.type === 'outroBlock',
                    'ml-5': index === 0,
                    'mr-5': index === blocks.length - 1,
                  }
                )}
                href={shouldScrollToCurrentBlock ? `#${block.id}` : undefined}
                onClick={() => {
                  setCurrentBlock(block)
                }}
              >
                {config.continuousRecording &&
                  block.type !== 'interactionBlock' && (
                    <input
                      className="absolute top-0 right-0 origin-top-right"
                      type="checkbox"
                      checked={
                        !!config.selectedBlocks.find(
                          (b) => b.blockId === block.id
                        )
                      }
                      onClick={(e) => {
                        handleBlockSelect(
                          block.id,
                          e.currentTarget.checked ? 'added' : 'removed',
                          index
                        )
                      }}
                    />
                  )}
                {recordedBlockIds.includes(block.id) &&
                  block.type !== 'interactionBlock' && (
                    <button
                      style={{
                        background: 'rgba(82, 82, 91, 0.7)',
                        boxShadow: '0px 25px 100px rgba(0, 0, 0, 0.5)',
                        backdropFilter: 'blur(4px)',
                        borderRadius: '2px',
                      }}
                      className={cx(
                        'flex items-center justify-center absolute m-1 top-0 left-0',
                        {
                          'mt-2.5 ml-3':
                            block.type === 'introBlock' ||
                            block.type === 'outroBlock',
                        }
                      )}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setBlockId(block.id)
                        setViewRecordingModal(true)
                      }}
                    >
                      <IoPlay size={10} className="m-1 text-white" />
                    </button>
                  )}

                {/* {block.type !== 'introBlock' && block.type !== 'outroBlock' && (
                  <input
                    type="checkbox"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedBlockIds(
                        selectedBlockIds.includes(block.id)
                          ? selectedBlockIds.filter((id) => id !== block.id)
                          : [...selectedBlockIds, block.id]
                      )
                    }}
                    checked={selectedBlockIds.includes(block.id)}
                    style={
                      selectedBlockIds.includes(block.id)
                        ? {
                            display: 'block',
                          }
                        : undefined
                    }
                    className="hidden group-hover:block bg-gray-600 text-incredible-green-600 rounded-sm absolute top-0 right-0 m-1"
                  />
                )} */}

                {(() => {
                  switch (block.type) {
                    case 'introBlock':
                      return (
                        config.blocks[block.id]?.view as IntroBlockView
                      )?.intro?.order
                        ?.filter((o) => o.enabled)
                        ?.map((order, index) => {
                          switch (order.state) {
                            case 'userMedia': {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updatePayload?.({
                                      activeIntroIndex: index,
                                    })
                                  }}
                                  className={cx(
                                    'border border-transparent rounded-md flex justify-center items-center w-24 h-12 p-3 bg-dark-100',
                                    {
                                      '!border-brand':
                                        payload.activeIntroIndex === index &&
                                        block.id === currentBlock?.id,
                                    }
                                  )}
                                >
                                  <UserPlaceholder className="w-full h-full" />
                                </button>
                              )
                            }

                            case 'titleSplash': {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (block.type === 'introBlock') {
                                      updatePayload?.({
                                        activeIntroIndex: index,
                                      })
                                    }
                                  }}
                                  className={cx(
                                    'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-2 ',
                                    {
                                      'bg-dark-100':
                                        block.type === 'introBlock',
                                      '!border-brand':
                                        payload.activeIntroIndex === index &&
                                        block.id === currentBlock?.id,
                                    }
                                  )}
                                >
                                  <FragmentTypeIcon type={block.type} />
                                </button>
                              )
                            }

                            case 'introVideo': {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updatePayload?.({
                                      activeIntroIndex: index,
                                    })
                                  }}
                                  className={cx(
                                    'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-3 bg-dark-100',
                                    {
                                      '!border-brand':
                                        payload.activeIntroIndex === index &&
                                        block.id === currentBlock?.id,
                                    }
                                  )}
                                >
                                  <IoPlayOutline className="w-full h-full text-gray-400" />
                                </button>
                              )
                            }

                            default:
                              return null
                          }
                        })

                    case 'outroBlock':
                      return (
                        config.blocks[block.id]?.view as OutroBlockView
                      )?.outro?.order
                        ?.filter((o) => o.enabled)
                        ?.map((order, index) => {
                          switch (order.state) {
                            case 'titleSplash': {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updatePayload?.({
                                      activeOutroIndex: index,
                                    })
                                  }}
                                  className={cx(
                                    'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-2 ',
                                    {
                                      'bg-dark-100':
                                        block.type === 'outroBlock',
                                      '!border-brand':
                                        payload.activeOutroIndex === index &&
                                        block.id === currentBlock?.id,
                                    }
                                  )}
                                >
                                  <FragmentTypeIcon type={block.type} />
                                </button>
                              )
                            }

                            case 'outroVideo': {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updatePayload?.({
                                      activeOutroIndex: index,
                                    })
                                  }}
                                  className={cx(
                                    'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-3 bg-dark-100',
                                    {
                                      '!border-brand':
                                        payload.activeOutroIndex === index &&
                                        block.id === currentBlock?.id,
                                    }
                                  )}
                                >
                                  <IoPlayOutline className="w-full h-full text-gray-400" />
                                </button>
                              )
                            }

                            default:
                              return null
                          }
                        })

                    case 'interactionBlock':
                      return (
                        <div
                          className={cx(
                            'border border-dark-100 rounded-md flex justify-center items-center w-12 h-12 p-2 bg-dark-300',
                            {
                              '!border-brand': block.id === currentBlock?.id,
                            }
                          )}
                        >
                          <div className="filter grayscale brightness-75">
                            {(() => {
                              switch (block.interactionBlock.interactionType) {
                                case 'codesandbox':
                                  return <CommandCodeSandbox />
                                case 'stackblitz':
                                  return <CommandStackBlitz />
                                case 'replit':
                                  return <CommandReplit />
                                default:
                                  return null
                              }
                            })()}
                          </div>
                        </div>
                      )

                    default:
                      return (
                        <button
                          type="button"
                          className={cx(
                            'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-2 ',
                            {
                              '!border-brand': block.id === currentBlock?.id,
                            }
                          )}
                        >
                          <FragmentTypeIcon type={block.type} />
                        </button>
                      )
                  }
                })()}
              </a>
            ))}
          </div>
        </div>
      )}
      {viewRecordingModal && (
        <ViewRecordingsModal
          open={viewRecordingModal}
          handleClose={() => {
            setViewRecordingModal(false)
          }}
          simpleAST={{
            blocks,
          }}
          blockId={blockId}
        />
      )}
    </div>
  )
}

export default Timeline
