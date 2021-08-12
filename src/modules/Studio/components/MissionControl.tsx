import { cx } from '@emotion/css'
import React, { HTMLAttributes, useContext } from 'react'
import { IconType } from 'react-icons'
import {
  FiMic,
  FiVideo,
  FiCheckCircle,
  FiStopCircle,
  FiXCircle,
  FiCircle,
  FiClipboard,
  FiMicOff,
  FiVideoOff,
} from 'react-icons/fi'
import { StudioContext } from '../Studio'

export const ControlButton = ({
  appearance,
  className,
  icon: I,
  ...rest
}: {
  appearance: 'primary' | 'danger' | 'success'
  icon: IconType
} & HTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      type="button"
      className={cx(
        'p-2 rounded-full flex items-center justify-center',
        {
          'bg-brand-10 text-brand': appearance === 'primary',
          'bg-error-10 text-error': appearance === 'danger',
          'bg-success-10 text-success': appearance === 'success',
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

const MissionControl = ({ controls }: { controls: JSX.Element[] }) => {
  const {
    constraints,
    toggleVideo,
    toggleAudio,
    startRecording,
    stopRecording,
    upload,
    reset,
    state,
  } = useContext(StudioContext)

  return (
    <div className="bg-gray-100 py-2 px-4 rounded-md">
      <div className="flex flex-col items-center justify-between h-full">
        <div className="flex items-center flex-col">
          <ControlButton icon={FiClipboard} appearance="primary" />

          <hr className="bg-grey-darker h-px my-2" />

          {controls}
        </div>
        <div>
          <ControlButton
            icon={constraints?.audio ? FiMic : FiMicOff}
            className="my-2"
            appearance={constraints?.audio ? 'primary' : 'danger'}
            onClick={() => toggleAudio(!constraints?.audio)}
          />
          <ControlButton
            icon={constraints?.video ? FiVideo : FiVideoOff}
            className="my-2"
            appearance={constraints?.video ? 'primary' : 'danger'}
            onClick={() => toggleVideo(!constraints?.video)}
          />

          <hr className="bg-grey-darker h-px my-2" />

          {state === 'recording' && (
            <ControlButton
              className="my-2"
              icon={FiStopCircle}
              appearance="danger"
              onClick={() => {
                stopRecording()
              }}
            />
          )}

          {state === 'preview' && (
            <ControlButton
              className="my-2"
              icon={FiXCircle}
              appearance="danger"
              onClick={() => {
                reset()
              }}
            />
          )}

          {state === 'preview' && (
            <ControlButton
              className="my-2"
              icon={FiCheckCircle}
              appearance="success"
              onClick={() => {
                upload()
              }}
            />
          )}
          {state === 'ready' && (
            <ControlButton
              className="my-2"
              icon={FiCircle}
              appearance="primary"
              onClick={() => {
                startRecording()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default MissionControl
