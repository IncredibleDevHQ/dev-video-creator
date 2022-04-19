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
import { Block, SimpleAST } from '../editor/utils/utils'
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

  const { fragment, blocks } = useMemo(() => {
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
    return {
      fragment,
      blocks,
    }
  }, [activeFragmentId])

  const totalTime = useMemo(() => {
    const totalTime = blocks?.reduce((acc, block) => {
      const { playbackDuration } = block
      return acc + (playbackDuration || 0)
    }, 0)
    return totalTime
  }, [blocks])

  const [selectedBlockId, setSelectedBlockId] = useState<string>()

  const elapsedTime = useMemo(() => {
    const selectedBlockIndex = blocks?.findIndex(
      (b) => b.id === selectedBlockId
    )
    if (selectedBlockIndex === -1) return 0
    const elapsedTime = blocks
      ?.slice(0, selectedBlockIndex)
      .reduce((acc, block) => {
        const { playbackDuration } = block
        return acc + (playbackDuration || 0)
      }, 0)
    return elapsedTime
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
    const ct = Math.ceil(videoRef.current?.currentTime || 0)
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
          {simpleAST?.blocks
            .filter((b) => blocks?.map((b) => b.id)?.includes(b.id))
            .map((b) => {
              return (
                <BlockTile
                  key={b.id}
                  block={blocks?.find((block) => block.id === b.id)}
                  selectedBlockId={selectedBlockId}
                  setSelectedBlockId={setSelectedBlockId}
                  blockType={b.type}
                />
              )
            })}
        </div>
      </div>
    </Modal>
  )
}

const BlockTile = ({
  block,
  selectedBlockId,
  setSelectedBlockId,
  blockType,
}: {
  block: BlockFragment | undefined
  selectedBlockId: string | undefined
  setSelectedBlockId: React.Dispatch<React.SetStateAction<string | undefined>>
  blockType: Block['type']
}) => {
  if (!block) return null

  return (
    <button
      type="button"
      className={cx(
        'flex border border-gray-300 ring-offset-2 bg-gray-100 items-center justify-center w-24 h-12 p-2 m-1 rounded-md cursor-pointer',
        {
          'border-brand': selectedBlockId === block.id,
        }
      )}
      onClick={() => {
        setSelectedBlockId(block.id)
      }}
    >
      {block.thumbnail ? (
        <img alt="block" src={config.storage.baseUrl + block.thumbnail} />
      ) : (
        <FragmentTypeIcon type={blockType} />
      )}
    </button>
  )
}

export default ViewRecordingsModal
