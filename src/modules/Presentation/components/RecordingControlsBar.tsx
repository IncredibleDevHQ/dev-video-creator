/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable consistent-return */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
import { cx } from '@emotion/css'
import Konva from 'konva'
import React, { HTMLAttributes, useEffect, useMemo } from 'react'
import { IconType } from 'react-icons'
import {
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoPause,
  IoPlay,
} from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import { ComputedPoint } from '../hooks/use-point'
import { presentationStore } from '../stores'
import {
  controlsConfigStore,
  PresentationProviderProps,
} from '../stores/presentation.store'
import {
  BrandingJSON,
  CodeAnimation,
  CodeBlockView,
  ListBlockView,
  ViewConfig,
} from '../utils/configTypes'
import { CodeBlockProps, ListBlock, ListBlockProps } from '../utils/utils'

export const ControlButton = ({
  appearance,
  className,
  icon: I,
  disabled,
  ...rest
}: {
  appearance: 'primary' | 'danger' | 'success'
  icon: IconType
  disabled?: boolean
} & HTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cx(
        'p-2 rounded-full flex items-center justify-center',
        {
          'bg-brand-10 text-brand': appearance === 'primary',
          'bg-error-10 text-error': appearance === 'danger',
          'bg-success-10 text-success': appearance === 'success',
          'opacity-70 cursor-not-allowed': disabled,
        },
        className
      )}
      {...rest}
    >
      <I
        color={(() => {
          switch (appearance) {
            case 'danger':
              return '#EF2D56'
            case 'primary':
              return '#5156EA'
            case 'success':
              return '#137547'
            default:
              return 'transparent'
          }
        })()}
      />
    </button>
  )
}

const RecordingControlsBar = ({
  stageRef,
  stageHeight,
  stageWidth,
  shortsMode,
  dataConfig,
  viewConfig,
}: {
  stageHeight: number
  stageWidth: number
  shortsMode: boolean
  stageRef: React.RefObject<Konva.Stage>
  dataConfig: any
  viewConfig: ViewConfig
}) => {
  const {
    payload,
    branding,
    // dataConfig,
    // viewConfig,
    setPayload,
    codePayload,
    setCodePayload,
    listPayload,
    setListPayload,
    videoPayload,
    setVideoPayload,
  } = (useRecoilValue(presentationStore) as PresentationProviderProps) || {}

  const controlsConfig = useRecoilValue(controlsConfigStore)

  useEffect(() => {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        performAction(
          viewConfig,
          dataConfig,
          payload,
          setPayload,
          codePayload,
          setCodePayload,
          listPayload,
          setListPayload,
          branding,
          controlsConfig,
          'previous'
        )
      }
      if (event.key === 'ArrowRight') {
        if (viewConfig && payload) {
          performAction(
            viewConfig,
            dataConfig,
            payload,
            setPayload,
            codePayload,
            setCodePayload,
            listPayload,
            setListPayload,
            branding,
            controlsConfig,
            'next'
          )
        }
      }
    })
  }, [viewConfig, dataConfig])

  const { isIntro, isOutro, isImage, isVideo, isCode, codeAnimation } =
    useMemo(() => {
      const blockType = dataConfig?.blocks[payload?.activeObjectIndex]?.type

      const codeBlockProps = dataConfig?.blocks[
        payload?.activeObjectIndex || 0
      ] as CodeBlockProps
      const codeBlockViewProps = viewConfig?.blocks[codeBlockProps.id]
        ?.view as CodeBlockView

      const codeAnimation = codeBlockViewProps?.code?.animation
      return {
        isIntro: blockType === 'introBlock',
        isOutro: blockType === 'outroBlock',
        isImage: blockType === 'imageBlock',
        isVideo: blockType === 'videoBlock',
        isCode: blockType === 'codeBlock',
        codeAnimation,
      }
    }, [payload?.activeObjectIndex])

  const isBackDisabled = () => {
    return payload?.activeObjectIndex === 0
  }

  return (
    <div
      style={{
        top: `${(stageRef?.current?.y() || 0) + stageHeight - 40}px`,
        width: `${stageWidth}px`,
      }}
      className="flex items-center justify-center absolute bottom-6 w-full"
    >
      <div
        className={cx('flex items-center ml-auto', {
          'mr-8': !shortsMode,
        })}
      >
        {isVideo && (
          <button
            className="bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm text-gray-100"
            type="button"
            onClick={() => {
              const { playing, videoElement } = controlsConfig
              const next = !playing
              setVideoPayload?.({
                ...videoPayload,
                playing: next,
                currentTime: videoElement?.currentTime || 0,
              })
            }}
          >
            {controlsConfig?.playing ? (
              <IoPause className="m-px w-5 h-5 p-px" />
            ) : (
              <IoPlay className="m-px w-5 h-5 p-px" />
            )}
          </button>
        )}

        <button
          className={cx(
            'bg-grey-400 border border-gray-600 backdrop-filter bg-opacity-50 backdrop-blur-2xl p-1.5 rounded-sm ml-4',
            {
              'bg-grey-500 bg-opacity-100 text-gray-100': !isBackDisabled(),
              'text-gray-500 cursor-not-allowed': isBackDisabled(),
            }
          )}
          type="button"
          disabled={isBackDisabled()}
          onClick={() => {
            if (viewConfig && payload)
              performAction(
                viewConfig,
                dataConfig,
                payload,
                setPayload,
                codePayload,
                setCodePayload,
                listPayload,
                setListPayload,
                branding,
                controlsConfig,
                'previous'
              )
          }}
        >
          <IoArrowBackOutline
            style={{
              margin: '3px',
            }}
            className="w-4 h-4 p-px"
          />
        </button>

        <button
          className={cx(
            'bg-grey-400 border border-gray-600 backdrop-filter bg-opacity-50 backdrop-blur-2xl p-1.5 rounded-sm ml-2',
            {
              'bg-opacity-50 text-gray-100':
                payload?.activeObjectIndex !== dataConfig?.blocks.length - 1,
              'text-gray-500 cursor-not-allowed':
                payload?.activeObjectIndex === dataConfig?.blocks.length - 1,
            }
          )}
          type="button"
          disabled={
            payload?.activeObjectIndex === dataConfig?.blocks.length - 1
          }
          onClick={() => {
            if (viewConfig && payload) {
              performAction(
                viewConfig,
                dataConfig,
                payload,
                setPayload,
                codePayload,
                setCodePayload,
                listPayload,
                setListPayload,
                branding,
                controlsConfig,
                'next'
              )
            }
          }}
        >
          <IoArrowForwardOutline
            style={{
              margin: '3px',
            }}
            className="w-4 h-4 p-px"
          />
        </button>
      </div>
    </div>
  )
}

const performAction = (
  viewConfig: ViewConfig,
  dataConfig: any,
  payload: any,
  setPayload: ((value: any) => void) | undefined,
  codePayload: any,
  setCodePayload: ((value: any) => void) | undefined,
  listPayload: any,
  setListPayload: ((value: any) => void) | undefined,
  branding: BrandingJSON | null | undefined,
  controlsConfig: any,
  direction: 'next' | 'previous' = 'next'
): boolean | undefined => {
  const block = dataConfig?.blocks[payload?.activeObjectIndex]
  switch (block.type) {
    case 'introBlock':
      handleIntroBlock(payload, setPayload, branding, direction)
      break
    case 'codeBlock':
      handleCodeBlock(
        viewConfig,
        dataConfig,
        payload,
        setPayload,
        codePayload,
        setCodePayload,
        controlsConfig,
        direction
      )
      break
    case 'videoBlock':
      handleVideoBlock(payload, setPayload, direction)
      break
    case 'imageBlock':
      handleImageBlock(payload, setPayload, direction)
      break
    case 'listBlock':
      handleListBlock(
        viewConfig,
        dataConfig,
        payload,
        setPayload,
        listPayload,
        setListPayload,
        controlsConfig,
        direction
      )
      break
    case 'headingBlock':
      handleImageBlock(payload, setPayload, direction)
      break
    case 'outroBlock':
      handleOutroBlock(payload, setPayload, direction)
      break
    default:
      return false
  }
}
const handleListBlock = (
  viewConfig: ViewConfig,
  dataConfig: any,
  payload: any,
  setPayload: ((value: any) => void) | undefined,
  listPayload: any,
  setListPayload: ((value: any) => void) | undefined,
  controlsConfig: any,
  direction: 'next' | 'previous'
) => {
  const listBlockProps = dataConfig?.blocks[
    payload?.activeObjectIndex || 0
  ] as ListBlockProps
  const listBlock = listBlockProps?.listBlock as ListBlock
  const listBlockViewProps = viewConfig?.blocks[listBlockProps.id]
    ?.view as ListBlockView
  const appearance = listBlockViewProps?.list?.appearance

  const computedPoints: ComputedPoint[] = controlsConfig?.computedPoints

  const noOfPoints = listBlock?.list?.length || 0

  if (direction === 'next') {
    if (listPayload?.activePointIndex === noOfPoints) {
      setPayload?.({
        ...payload,
        activeObjectIndex: payload?.activeObjectIndex + 1,
      })
    } else if (appearance === 'allAtOnce') {
      const index = computedPoints.findIndex(
        (point) =>
          point.startFromIndex >
          computedPoints[listPayload?.activePointIndex].startFromIndex
      )
      setListPayload?.({
        ...listPayload,
        activePointIndex: index !== -1 ? index : computedPoints.length,
      })
      // return false;
    } else {
      setListPayload?.({
        ...listPayload,
        activePointIndex: listPayload?.activePointIndex + 1 || 1,
      })
    }
  } else if (direction === 'previous') {
    switch (appearance) {
      case 'allAtOnce':
        setPayload?.({
          ...payload,
          activeObjectIndex: payload?.activeObjectIndex - 1,
        })
        break
      case 'replace':
      case 'stack':
        if (listPayload?.activePointIndex === 0) {
          setPayload?.({
            ...payload,
            activeObjectIndex: payload?.activeObjectIndex - 1,
          })
        } else {
          setListPayload?.({
            ...listPayload,
            activePointIndex: listPayload?.activePointIndex - 1,
          })
        }
        break
      default:
        break
    }
  }
}

const handleImageBlock = (
  payload: any,
  setPayload: ((value: any) => void) | undefined,
  direction: 'next' | 'previous'
) => {
  if (direction === 'next') {
    setPayload?.({
      ...payload,
      activeObjectIndex: payload?.activeObjectIndex + 1,
    })
  }
  if (direction === 'previous') {
    setPayload?.({
      ...payload,
      activeObjectIndex: payload?.activeObjectIndex - 1,
    })
  }
}

const handleVideoBlock = (
  payload: any,
  setPayload: ((value: any) => void) | undefined,
  direction: 'next' | 'previous'
) => {
  if (direction === 'next') {
    setPayload?.({
      ...payload,
      activeObjectIndex: payload?.activeObjectIndex + 1,
    })
  }
  if (direction === 'previous') {
    setPayload?.({
      ...payload,
      activeObjectIndex: payload?.activeObjectIndex - 1,
    })
  }
}

const handleCodeBlock = (
  viewConfig: ViewConfig,
  dataConfig: any,
  payload: any,
  setPayload: ((value: any) => void) | undefined,
  codePayload: any,
  setCodePayload: ((value: any) => void) | undefined,
  controlsConfig: any,
  direction: 'next' | 'previous'
) => {
  const codeBlockProps = dataConfig?.blocks[
    payload?.activeObjectIndex || 0
  ] as CodeBlockProps
  const codeBlockViewProps = viewConfig.blocks[codeBlockProps.id]
    ?.view as CodeBlockView
  const noOfBlocks = codeBlockViewProps?.code.highlightSteps?.length
  const codeAnimation = codeBlockViewProps?.code.animation
  const { position, computedTokens } = controlsConfig

  if (direction === 'next') {
    switch (codeAnimation) {
      case CodeAnimation.HighlightLines: {
        if (noOfBlocks === undefined) return
        if (
          codePayload?.activeBlockIndex === noOfBlocks &&
          !codePayload?.focusBlockCode
        ) {
          setPayload?.({
            ...payload,
            activeObjectIndex: payload?.activeObjectIndex + 1,
          })
        } else if (codePayload?.focusBlockCode) {
          setCodePayload?.({
            ...codePayload,
            focusBlockCode: false,
          })
        } else if (codePayload?.activeBlockIndex < noOfBlocks) {
          setCodePayload?.({
            ...codePayload,
            activeBlockIndex: codePayload?.activeBlockIndex + 1,
            focusBlockCode: true,
          })
        }
        break
      }
      case CodeAnimation.TypeLines: {
        if (codePayload?.currentIndex === computedTokens?.length) {
          setPayload?.({
            ...payload,
            activeObjectIndex: payload?.activeObjectIndex + 1,
          })
        } else {
          const current = computedTokens[position.currentIndex]
          let next = computedTokens.findIndex(
            (t: any) => t.lineNumber > current.lineNumber
          )
          if (next === -1) next = computedTokens.length
          setCodePayload?.({
            ...codePayload,
            prevIndex: position.currentIndex,
            currentIndex: next,
            isFocus: false,
          })
        }
        break
      }
      default:
        break
    }
  } else if (direction === 'previous') {
    switch (codeAnimation) {
      case CodeAnimation.HighlightLines: {
        if (noOfBlocks === undefined) return
        if (codePayload?.activeBlockIndex === 0) {
          setPayload?.({
            ...payload,
            activeObjectIndex: payload?.activeObjectIndex - 1,
          })
        }
        if (codePayload?.activeBlockIndex === 1) {
          setCodePayload?.({
            ...codePayload,
            activeBlockIndex: codePayload?.activeBlockIndex - 1,
            focusBlockCode: false,
          })
        } else {
          setCodePayload?.({
            ...codePayload,
            activeBlockIndex: codePayload?.activeBlockIndex - 1,
            focusBlockCode: true,
          })
        }
        break
      }
      case CodeAnimation.TypeLines: {
        if (codePayload?.currentIndex === 0) {
          setPayload?.({
            ...payload,
            activeObjectIndex: payload?.activeObjectIndex - 1,
          })
        } else {
          const current = computedTokens[position.currentIndex - 1]
          let next = [...computedTokens]
            .reverse()
            .findIndex((t: any) => t.lineNumber < current.lineNumber)
          if (next === -1) next = computedTokens.length
          setCodePayload?.({
            ...codePayload,
            prevIndex: computedTokens.length - next - 1,
            currentIndex: computedTokens.length - next,
            isFocus: false,
          })
        }
        break
      }
      default:
        break
    }
    return false
  }
}

const handleIntroBlock = (
  payload: any,
  setPayload: ((value: any) => void) | undefined,
  branding: BrandingJSON | null | undefined,
  direction: 'next' | 'previous'
) => {
  if (direction === 'next') {
    setPayload?.({
      ...payload,
      activeObjectIndex: payload?.activeObjectIndex + 1,
    })
    // return true;
    // eslint-disable-next-line no-else-return
    // } else {
    // 	setIntroPayload?.({
    // 		...payload,
    // 		activeIntroIndex: introPayload?.activeIntroIndex + 1,
    // 	});
    // }
  }
  // else if (direction === 'previous') {
  // 	if (introPayload?.activeIntroIndex !== 0) {
  // 		setIntroPayload?.({
  // 			...payload,
  // 			activeIntroIndex: introPayload?.activeIntroIndex - 1,
  // 		});
  // 	}
  // }
  // return false;
}

const handleOutroBlock = (
  payload: any,
  setPayload: ((value: any) => void) | undefined,
  direction: 'next' | 'previous'
) => {
  if (direction === 'previous') {
    setPayload?.({
      ...payload,
      activeObjectIndex: payload?.activeObjectIndex - 1,
    })
  }
}

ControlButton.defaultProps = {
  disabled: false,
}

export default RecordingControlsBar
