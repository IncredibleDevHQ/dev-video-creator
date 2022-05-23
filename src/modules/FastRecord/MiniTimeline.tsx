import { css, cx } from '@emotion/css'
import React, { useEffect, useRef } from 'react'
import { IoCheckmarkOutline } from 'react-icons/io5'
import config from '../../config'
import { RecordedBlocksFragment } from '../../generated/graphql'
import { Block, useUtils } from '../Flick/editor/utils/utils'
import { StudioState } from '../Studio/stores'

const noScrollBar = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const MiniTimeline = ({
  blocks,
  recordedBlocks,
  currentBlock,
  payload,
  state,
  setCurrentBlock,
  setState,
  updatePayload,
  setRecordedVideoSrc,
}: {
  blocks: Block[]
  recordedBlocks: RecordedBlocksFragment[] | undefined
  currentBlock: Block | undefined
  payload: any
  state: StudioState
  setCurrentBlock: (block: Block) => void
  setState: (state: StudioState) => void
  updatePayload: (value: any) => void
  setRecordedVideoSrc: (src: string) => void
}) => {
  const utils = useUtils()

  const timelineRef = useRef<HTMLDivElement>(null)

  function isInViewport(element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  useEffect(() => {
    const block = blocks[payload?.activeObjectIndex]

    if (!block) return

    setCurrentBlock(block)

    // check if block was already recorded and if so show the video preview
    const previouslyRecordedBlock = recordedBlocks?.find((b) => {
      return b.id === block?.id
    })
    if (previouslyRecordedBlock) {
      setRecordedVideoSrc(
        `${config.storage.baseUrl}${previouslyRecordedBlock.objectUrl}`
      )
      setState('preview')
    }

    // update timeline
    const ele = document.getElementById(`timeline-block-${block.id}`)
    if (!ele) return
    if (!isInViewport(ele) && timelineRef.current) {
      let scrollAmount = 0
      const slideTimer = setInterval(() => {
        if (!timelineRef.current) return
        timelineRef.current.scrollLeft += 100
        scrollAmount += 100
        if (scrollAmount >= 1000) {
          window.clearInterval(slideTimer)
        }
      }, 25)
    }
  }, [payload?.activeObjectIndex])

  return (
    <div
      ref={timelineRef}
      style={{
        background: '#27272A',
      }}
      onWheel={(e) => {
        if (timelineRef.current) {
          timelineRef.current.scrollLeft += e.deltaY
        }
      }}
      className={cx(
        'mt-auto flex gap-x-4 px-6 py-3 overflow-x-scroll h-14',
        {
          'pointer-events-none':
            state === 'preview' && recordedBlocks && currentBlock
              ? recordedBlocks
                  ?.find((b) => b.id === currentBlock.id)
                  ?.objectUrl?.includes('blob') || false
              : false,
        },
        noScrollBar
      )}
    >
      {blocks.map((block, index) => {
        return (
          <button
            type="button"
            id={`timeline-block-${block.id}`}
            className={cx(
              'px-3 py-1.5 font-body cursor-pointer text-sm rounded-sm flex items-center justify-center transition-transform duration-500 bg-brand-grey relative text-gray-300 flex-shrink-0',
              {
                'transform scale-110 border border-brand':
                  payload?.activeObjectIndex === index,
                'bg-grey-900 text-gray-500':
                  index !== payload?.activeObjectIndex,
                'cursor-not-allowed':
                  state === 'recording' ||
                  state === 'start-recording' ||
                  (recordedBlocks
                    ?.find((b) => b?.id === currentBlock?.id)
                    ?.objectUrl?.includes('blob') &&
                    state === 'preview'),

                // state !== 'ready' || state !== 'preview',
              }
            )}
            onClick={() => {
              const newSrc =
                recordedBlocks && currentBlock
                  ? recordedBlocks?.find((b) => b.id === currentBlock.id)
                      ?.objectUrl || ''
                  : ''
              if (newSrc.includes('blob') && state === 'preview') return

              // checking if block already has recording
              const clickedBlock = recordedBlocks?.find((b) => {
                return b.id === block.id
              })

              updatePayload({
                activeObjectIndex: index,
              })

              console.log('clickedBlock', clickedBlock)

              // when block was previously rec and uploaded and we have a url to show preview
              if (clickedBlock && clickedBlock.objectUrl) {
                setState('preview')
              } else {
                // when the clicked block is not yet recorded.
                setState('resumed')
              }
            }}
          >
            {recordedBlocks
              ?.find((b) => b.id === block.id)
              ?.objectUrl?.includes('.webm') && (
              <div className="absolute top-0 right-0 rounded-tr-sm rounded-bl-sm bg-incredible-green-600">
                <IoCheckmarkOutline className="m-px text-gray-200" size={8} />
              </div>
            )}
            <span>
              {utils.getBlockTitle(block).substring(0, 40) +
                (utils.getBlockTitle(block).length > 40 ? '...' : '')}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default MiniTimeline
