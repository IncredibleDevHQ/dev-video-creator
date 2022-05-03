import { css, cx } from '@emotion/css'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  IoChevronBackCircle,
  IoChevronForwardCircle,
  IoPlay,
  IoPlayOutline,
} from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import { ReactComponent as UserPlaceholder } from '../../../assets/StudioUser.svg'
import { ReactComponent as TimelineIcon } from '../../../assets/Timeline.svg'
import { Button, emitToast, Text } from '../../../components'
import { logEvent } from '../../../utils/analytics'
import { PageEvent } from '../../../utils/analytics-types'
import {
  IntroBlockView,
  OutroBlockView,
  ViewConfig,
} from '../../../utils/configTypes'
import { studioStore } from '../../Studio/stores'
import { Block } from '../editor/utils/utils'
import { newFlickStore, View } from '../store/flickNew.store'
import { FragmentTypeIcon } from './LayoutGeneric'
import ViewRecordingsModal from './ViewRecordingsModal'
import { ReactComponent as CommandCodeSandbox } from '../../../assets/Command_CodeSandbox.svg'
import { ReactComponent as CommandStackBlitz } from '../../../assets/Command_Stackblitz.svg'
import { ReactComponent as CommandReplit } from '../../../assets/Command_Replit.svg'

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
  setConfig?: React.Dispatch<React.SetStateAction<ViewConfig>>
}) => {
  const { payload, updatePayload } = useRecoilValue(studioStore)
  const timeline = useRef<HTMLDivElement>(null)

  const { view, flick, activeFragmentId } = useRecoilValue(newFlickStore)

  const [viewRecordingModal, setViewRecordingModal] = useState(false)
  const [blockId, setBlockId] = useState('')

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

  const slide = (direction: 'left' | 'right') => {
    let scrollCompleted = 0
    const slideVar = setInterval(() => {
      if (!timeline.current) return
      if (direction === 'left') {
        timeline.current.scrollLeft -= 75
      } else {
        timeline.current.scrollLeft += 75
      }
      scrollCompleted += 75
      if (scrollCompleted >= 750) {
        window.clearInterval(slideVar)
      }
    }, 25)
  }

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
          setConfig?.((prevConfig) => ({
            ...prevConfig,
            selectedBlocks: [
              { blockId, pos: timelineIndex },
              ...config.selectedBlocks,
            ],
          }))
        } else if (
          config.selectedBlocks[config.selectedBlocks.length - 1].pos + 1 ===
          currentBlockIndex
        ) {
          console.log('Adding to back')
          setConfig?.((prevConfig) => ({
            ...prevConfig,
            selectedBlocks: [
              ...config.selectedBlocks,
              { blockId, pos: timelineIndex },
            ],
          }))
        } else if (
          checkInBetween(config.selectedBlocks[0].pos, currentBlockIndex) ||
          checkInBetween(currentBlockIndex, config.selectedBlocks[0].pos)
        ) {
          console.log('Adding in between')
          setConfig?.((prevConfig) => ({
            ...prevConfig,
            selectedBlocks: [
              ...config.selectedBlocks,
              { blockId, pos: timelineIndex },
            ],
          }))
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
      className={cx('absolute flex flex-col bottom-0 left-0 w-full z-50', {
        relative: persistentTimeline,
      })}
    >
      {!persistentTimeline && (
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
          {showTimeline && (
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

      {showTimeline && (
        <>
          <div className="absolute right-0 flex items-center h-full">
            <IoChevronForwardCircle
              className={cx(
                'text-white hover:text-white opacity-40 hover:opacity-60 mr-1 cursor-pointer',
                {
                  'mt-12': !persistentTimeline,
                }
              )}
              onClick={() => slide('right')}
              size={32}
            />
          </div>
          <div className="absolute left-0 flex items-center h-full">
            <IoChevronBackCircle
              className={cx(
                'text-white hover:text-white opacity-40 hover:opacity-60 ml-1 cursor-pointer',
                {
                  'mt-12': !persistentTimeline,
                }
              )}
              onClick={() => slide('left')}
              size={32}
            />
          </div>
        </>
      )}

      {showTimeline && (
        <div className="flex">
          <div className="h-24" />
          <div
            ref={timeline}
            className={cx(
              'flex items-center w-full bg-dark-500 py-4 px-5 gap-x-4 overflow-x-scroll',
              css`
                ::-webkit-scrollbar {
                  display: none;
                }
              `
            )}
          >
            {blocks.map((block: Block, index) => (
              <a
                className={cx(
                  'flex items-center gap-x-3 border border-transparent cursor-pointer relative',
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
                {(() => {
                  switch (block.type) {
                    case 'introBlock':
                      return (
                        config.blocks[block.id].view as IntroBlockView
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
