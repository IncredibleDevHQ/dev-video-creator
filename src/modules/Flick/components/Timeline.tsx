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
import { BrandingInterface } from '../../Branding/BrandingPage'
import { studioStore } from '../../Studio/stores'
import { Block } from '../editor/utils/utils'
import { newFlickStore } from '../store/flickNew.store'
import { FragmentTypeIcon } from './LayoutGeneric'

const Timeline = ({
  blocks,
  currentBlock,
  setCurrentBlock,
  persistentTimeline = false,
  shouldScrollToCurrentBlock = true,
  showTimeline,
  setShowTimeline,
}: {
  blocks: Block[]
  currentBlock: Block | undefined
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
  persistentTimeline: boolean
  shouldScrollToCurrentBlock: boolean
  showTimeline: boolean
  setShowTimeline: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const { flick } = useRecoilValue(newFlickStore)
  const { payload, updatePayload } = useRecoilValue(studioStore)
  const timeline = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setShowTimeline(persistentTimeline)
  }, [])

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
      className={cx('absolute flex flex-col bottom-0 left-0 w-full', {
        relative: persistentTimeline,
      })}
    >
      {!persistentTimeline && (
        <Button
          appearance="gray"
          type="button"
          size="small"
          className={cx(
            'flex items-center mx-4 my-2 hover:bg-gray-700 max-w-max',
            css(`
            --tw-bg-opacity: 1;
            background-color: rgba(17, 24, 39, var(--tw-bg-opacity));
        `)
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
                      block.type === 'introBlock',
                    'ml-5': index === 0,
                    'mr-5': index === blocks.length - 1,
                  }
                )}
                href={shouldScrollToCurrentBlock ? `#${block.id}` : undefined}
                onClick={() => {
                  setCurrentBlock(block)
                }}
              >
                {block.type === 'introBlock' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        updatePayload?.({
                          activeIntroIndex: 0,
                        })
                      }}
                      className={cx(
                        'border border-transparent rounded-md flex justify-center items-center w-24 h-12 p-3 bg-dark-100',
                        {
                          '!border-brand':
                            currentBlock?.type === 'introBlock' &&
                            payload.activeIntroIndex === 0,
                          'border-dark-100':
                            currentBlock?.type !== 'introBlock',
                        }
                      )}
                    >
                      <UserPlaceholder className="w-full h-full" />
                    </button>
                    {flick?.branding &&
                      flick?.useBranding &&
                      (flick?.branding as BrandingInterface).branding
                        ?.introVideoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            updatePayload?.({
                              activeIntroIndex: 1,
                            })
                          }}
                          className={cx(
                            'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-3 bg-dark-100',
                            {
                              '!border-brand':
                                currentBlock?.type === 'introBlock' &&
                                payload.activeIntroIndex === 1,
                            }
                          )}
                        >
                          <IoPlayOutline className="w-full h-full text-gray-400" />
                        </button>
                      )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (block.type === 'introBlock') {
                      updatePayload?.({
                        activeIntroIndex: flick?.branding?.branding
                          .introVideoUrl
                          ? 2
                          : 1,
                      })
                    }
                  }}
                  className={cx(
                    'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-2 ',
                    {
                      'bg-dark-100': block.type === 'introBlock',
                      '!border-brand':
                        (currentBlock?.type === 'introBlock' &&
                          payload.activeIntroIndex ===
                            (flick?.branding?.branding.introVideoUrl ? 2 : 1) &&
                          block.id === currentBlock?.id) ||
                        (currentBlock?.type !== 'introBlock' &&
                          block.id === currentBlock?.id),
                    }
                  )}
                >
                  <FragmentTypeIcon type={block.type} />
                </button>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Timeline
