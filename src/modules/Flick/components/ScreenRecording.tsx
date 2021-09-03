import { css, cx } from '@emotion/css'
import React from 'react'
import { Modal } from 'react-responsive-modal'
import useScreenRecorder from 'use-screen-recorder'
import { Button, Heading } from '../../../components'

const ScreenRecording = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const {
    blobUrl,
    pauseRecording,
    resetRecording,
    resumeRecording,
    startRecording,
    status,
    stopRecording,
  } = useScreenRecorder({
    audio: true,
  })
  console.log('status', status)

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-3xl h-5xl md:w-1/2',
          css`
            background-color: #fffffff !important;
          `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
    >
      <div className="flex flex-row gap-3 w-48 m-2">
        {status === 'stopped' && <video src={blobUrl || ''} controls />}

        {status === 'idle' && (
          <Button
            type="button"
            appearance="primary"
            className="border-white h-auto"
            onClick={startRecording}
          >
            Start Recording
          </Button>
        )}

        {status === 'paused' && (
          <Button
            type="button"
            appearance="primary"
            className="border-white h-auto"
            onClick={resumeRecording}
          >
            Resume Recording
          </Button>
        )}

        {status === 'recording' && (
          <>
            <Button
              type="button"
              appearance="primary"
              className="border-white h-auto"
              onClick={stopRecording}
            >
              Stop Recording
            </Button>
            <Button
              type="button"
              appearance="primary"
              className="border-white h-auto"
              onClick={pauseRecording}
            >
              Pause Recording
            </Button>
          </>
        )}
        {status !== 'stopped' && (
          <Button
            type="button"
            appearance="primary"
            className="border-white h-auto"
            onClick={resetRecording}
          >
            Reset Recording
          </Button>
        )}
      </div>
    </Modal>
  )
}

export default ScreenRecording
