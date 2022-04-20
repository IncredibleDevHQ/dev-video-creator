/* eslint-disable jsx-a11y/media-has-caption */
import { cx } from '@emotion/css'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { IoPauseOutline, IoPlayOutline } from 'react-icons/io5'
import Modal from 'react-responsive-modal'
import useMeasure from 'react-use-measure'
import { useRecoilValue } from 'recoil'
import { Heading } from '../../../components'
import config from '../../../config'
import {
  BlockFragment,
  Fragment_Type_Enum_Enum,
} from '../../../generated/graphql'
import { SimpleAST } from '../editor/utils/utils'
import { newFlickStore } from '../store/flickNew.store'
import { useGetHW } from './BlockPreview'
import { FragmentTypeIcon } from './LayoutGeneric'

const ViewRecordingsModal = ({
  blockId,
  open,
  simpleAST,
  handleClose,
}: {
  blockId?: string
  open: boolean
  simpleAST: SimpleAST | undefined
  handleClose: (refresh?: boolean) => void
}) => {
  const { flick, activeFragmentId } = useRecoilValue(newFlickStore)

  const { fragment, blocks, groupedBlocks } = useMemo(() => {
    const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)
    const blockIds = fragment?.blocks?.map((b) => b.id)
    const blocks: BlockFragment[] = []
    simpleAST?.blocks
      .filter((b) => blockIds?.includes(b.id))
      .forEach((b) => {
        const block = fragment?.blocks.find((fb) => fb.id === b.id)
        if (block) {
          blocks.push(block)
        }
      })

    // group blocks by objectUrl
    const groupedBlocks = blocks?.reduce((acc, curr) => {
      const { objectUrl } = curr
      if (!objectUrl) return acc
      if (!acc[objectUrl]) {
        acc[objectUrl] = []
      }
      acc[objectUrl].push(curr)
      return acc
    }, {} as { [key: string]: BlockFragment[] })

    return {
      fragment,
      blocks,
      groupedBlocks,
    }
  }, [activeFragmentId])

  const totalTime = useMemo(() => {
    const totalTime = Object.keys(groupedBlocks).reduce((acc, key) => {
      let sum = acc
      groupedBlocks[key].forEach((b, index) => {
        if (index === 0) {
          sum += b.playbackDuration || 0
        } else {
          sum += b.playbackDuration || 0
          groupedBlocks[key].slice(0, index).forEach((b) => {
            sum -= b.playbackDuration || 0
          })
        }
      })
      return sum
    }, 0)
    return totalTime
  }, [blocks])

  const [selectedBlockId, setSelectedBlockId] = useState<string>()

  const elapsedTime = useMemo(() => {
    const selectedBlockIndex = Object.keys(groupedBlocks).findIndex(
      (key) => groupedBlocks[key][0].id === selectedBlockId
    )

    if (selectedBlockIndex === -1) return 0
    const elapsedTime = Object.keys(groupedBlocks)
      .slice(0, selectedBlockIndex)
      .reduce((acc, key) => {
        let sum = acc
        groupedBlocks[key].forEach((b, index) => {
          if (index === 0) {
            sum += b.playbackDuration || 0
          } else {
            sum += b.playbackDuration || 0
            groupedBlocks[key].slice(0, index).forEach((b) => {
              sum -= b.playbackDuration || 0
            })
          }
        })
        return sum
      }, 0)
    return elapsedTime
  }, [selectedBlockId])

  const largestDuration = useMemo(() => {
    let largestDuration = 0
    Object.keys(groupedBlocks).forEach((key) => {
      const lastBlock = groupedBlocks[key][groupedBlocks[key].length - 1]
      if (
        lastBlock.playbackDuration &&
        lastBlock.playbackDuration > largestDuration
      ) {
        largestDuration = lastBlock.playbackDuration
      }
    }, 0)

    return largestDuration
  }, [selectedBlockId])

  const getMinuteAndSecondsFromSeconds = (s: number) => {
    const minutes = Math.floor(s / 60)
    const seconds = Math.floor(s % 60)
    return `${minutes < 10 ? '0' : ''}${minutes}:${
      seconds < 10 ? '0' : ''
    }${seconds}`
  }
  const [isPlaying, setIsPlaying] = useState(false)

  const selectedBlockIdRef = useRef(selectedBlockId)
  useEffect(() => {
    selectedBlockIdRef.current = selectedBlockId
    setIsPlaying(false)
  }, [selectedBlockId])

  useEffect(() => {
    if (blockId) {
      setSelectedBlockId(blockId)
    } else if (blocks && blocks.length > 0) {
      const blockIds = blocks.map((b) => b.id)
      const bid = simpleAST?.blocks.find((b) => blockIds.includes(b.id))?.id
      setSelectedBlockId(bid)
    }
  }, [blocks, simpleAST])

  const [ref, bounds] = useMeasure()

  const videoRef = useRef<HTMLVideoElement>(null)

  videoRef.current?.addEventListener('ended', () => {
    setIsPlaying(false)
  })

  const [currentTime, setCurrentTime] = useState(0)

  videoRef.current?.addEventListener('timeupdate', () => {
    const ct = Math.round(videoRef.current?.currentTime || 0)
    setCurrentTime(ct)
  })

  const { height, width } = useGetHW({
    maxH: bounds.height / 1.1,
    maxW: bounds.width / 1.1,
    aspectRatio:
      fragment?.type === Fragment_Type_Enum_Enum.Portrait ? 9 / 16 : 16 / 9,
  })

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      styles={{
        modal: {
          maxWidth: '90%',
          width: '100%',
          maxHeight: '90vh',
          height: '100%',
          padding: '0',
        },
      }}
      classNames={{
        modal: cx('rounded-md m-0 p-0'),
      }}
      center
      showCloseIcon={false}
    >
      <div className="flex flex-col w-full h-full">
        <div className="flex items-center w-full pl-4 pr-2 py-2.5 border-b border-gray-300">
          <Heading>Recording</Heading>
        </div>
        <div
          className="flex flex-col flex-1 items-center justify-center gap-y-2 relative"
          ref={ref}
        >
          <div className="flex items-center">
            <video
              ref={videoRef}
              height={height}
              width={width}
              loop={false}
              style={{
                minWidth: width,
                minHeight: height,
                background: '#ffffff',
              }}
              className="border"
              src={
                config.storage.baseUrl +
                blocks?.find((b) => b.id === selectedBlockId)?.objectUrl
              }
              preload="auto"
            />
          </div>
          <div className="flex items-center gap-x-3">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(!isPlaying)
                if (isPlaying) {
                  videoRef.current?.pause()
                } else {
                  videoRef.current?.play()
                }
              }}
              className="bg-gray-300 rounded-sm"
            >
              {!isPlaying ? (
                <IoPlayOutline className="m-2" />
              ) : (
                <IoPauseOutline className="m-2" />
              )}
            </button>
            <div className="w-32 overflow-hidden flex items-center font-body">
              <div className="w-12 overflow-hidden">{`${getMinuteAndSecondsFromSeconds(
                elapsedTime + currentTime
              )}`}</div>
              <span>{`/ ${getMinuteAndSecondsFromSeconds(totalTime)}`}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center mt-auto bg-gray-100 p-4 gap-x-2">
          {Object.keys(groupedBlocks).map((objectUrl) => {
            return (
              <BlockTile
                key={objectUrl}
                groupedBlocks={groupedBlocks[objectUrl]}
                selectedBlockId={selectedBlockId}
                setSelectedBlockId={setSelectedBlockId}
                simpleAST={simpleAST}
                largestDuration={largestDuration}
              />
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

const BlockTile = ({
  selectedBlockId,
  setSelectedBlockId,
  groupedBlocks,
  simpleAST,
  largestDuration,
}: {
  selectedBlockId: string | undefined
  setSelectedBlockId: React.Dispatch<React.SetStateAction<string | undefined>>
  groupedBlocks: BlockFragment[]
  simpleAST: SimpleAST | undefined
  largestDuration: number
}) => {
  const { widthByDuration, noOfImages } = useMemo(() => {
    const width =
      ((groupedBlocks[groupedBlocks.length - 1].playbackDuration || 0) /
        largestDuration) *
      100 *
      2
    const noOfImages = Math.ceil(width / 85)
    return {
      widthByDuration: width,
      noOfImages,
    }
  }, [])

  return (
    <button
      type="button"
      style={{
        height: '56px',
        width: `${widthByDuration}px`,
      }}
      className={cx(
        'flex border border-gray-300 ring-offset-2 bg-white items-center m-1 rounded-sm cursor-pointer overflow-hidden py-px px-1 gap-x-1',
        {
          'border-brand': selectedBlockId === groupedBlocks[0].id,
          'justify-center': !groupedBlocks[0].thumbnail,
        }
      )}
      onClick={() => {
        setSelectedBlockId(groupedBlocks[0].id)
      }}
    >
      <>
        {groupedBlocks[0].thumbnail ? (
          [...Array(noOfImages).keys()].map(() => (
            <div
              className="rounded-none flex-shrink-0"
              style={{
                height: '48px',
                width: '85.33px',
                backgroundImage: `url(${
                  config.storage.baseUrl + groupedBlocks[0].thumbnail
                })`,
                backgroundSize: 'cover',
                backgroundRepeat: 'repeat-x',
              }}
            />
          ))
        ) : (
          <div className="p-1">
            <FragmentTypeIcon
              type={
                simpleAST?.blocks.find((b) => b.id === groupedBlocks[0].id)
                  ?.type || 'composedBlock'
              }
            />
          </div>
        )}
      </>
    </button>
  )
}

export default ViewRecordingsModal
