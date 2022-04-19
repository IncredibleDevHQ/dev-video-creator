import { css, cx } from '@emotion/css'
import React, { useEffect, useRef } from 'react'
import {
  IoChevronBackCircle,
  IoChevronForwardCircle,
  IoPlayOutline,
} from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import { ReactComponent as UserPlaceholder } from '../../../assets/StudioUser.svg'
import { ReactComponent as TimelineIcon } from '../../../assets/Timeline.svg'
import { Button, Text } from '../../../components'
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

const Timeline = ({
  blocks,
  currentBlock,
  setCurrentBlock,
  persistentTimeline = false,
  shouldScrollToCurrentBlock = true,
  showTimeline,
  config,
  setShowTimeline,
}: {
  blocks: Block[]
  currentBlock: Block | undefined
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
  persistentTimeline: boolean
  shouldScrollToCurrentBlock: boolean
  showTimeline: boolean
  config: ViewConfig
  setShowTimeline: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const { payload, updatePayload } = useRecoilValue(studioStore)
  const timeline = useRef<HTMLDivElement>(null)

  const { view } = useRecoilValue(newFlickStore)

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

  return (
    <div
      className={cx('absolute flex flex-col bottom-0 left-0 w-full z-50', {
        relative: persistentTimeline,
      })}
    >
      {!persistentTimeline && (
        <Button
          appearance="gray"
          type="button"
          size="small"
          className={cx(
            'flex items-center mx-4 my-2 hover:bg-gray-700 bg-dark-500 max-w-max'
          )}
          onClick={() => {
            // Segment Tracking
            logEvent(
              showTimeline ? PageEvent.OpenTimeLine : PageEvent.CloseTimeLine
            )
            setShowTimeline(!showTimeline)
          }}
        >
          <TimelineIcon className="w-6 h-6 mr-1" />
          <Text className="text-sm">
            {showTimeline ? 'Close timeline' : 'Open timeline'}
          </Text>
        </Button>
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
                  'flex items-center gap-x-3 border border-transparent cursor-pointer',
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
                {block.type === 'introBlock' &&
                  (config.blocks[block.id].view as IntroBlockView)?.intro?.order
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
                                  'bg-dark-100': block.type === 'introBlock',
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
                    })}
                {block.type === 'outroBlock' &&
                  (config.blocks[block.id].view as OutroBlockView)?.outro?.order
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
                                  'bg-dark-100': block.type === 'outroBlock',
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
                    })}
                {block.type !== 'introBlock' && block.type !== 'outroBlock' && (
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
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Timeline
