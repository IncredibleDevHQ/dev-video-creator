import { css, cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import Select from 'react-select'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Button, Heading } from '../../../components'
import { StudioProviderProps, studioStore } from '../stores'

const SwitchMediaDevices = ({
  cameraDevices,
  audioDevices,
  open,
  handleClose,
}: {
  cameraDevices: MediaDeviceInfo[]
  audioDevices: MediaDeviceInfo[]
  open: boolean
  handleClose: () => void
}) => {
  const { constraints, mute, updateParticipant } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [cam, setcam] = useState<{
    value: string | undefined
    label: string | undefined
  } | null>({ value: '', label: '' })
  const [cameraoptions, setCameraOptions] = useState<
    {
      value: string
      label: string
    }[]
  >([{ value: '', label: '' }])

  const [microphone, setMicrophone] = useState<{
    value: string | undefined
    label: string | undefined
  } | null>({ value: '', label: '' })
  const [microphoneOptions, setMicrophoneOptions] = useState<
    {
      value: string
      label: string
    }[]
  >([{ value: '', label: '' }])

  const [studio, setStudio] = useRecoilState(studioStore)

  useEffect(() => {
    if (!cameraDevices) return
    setcam({ value: cameraDevices[0].deviceId, label: cameraDevices[0].label })
    const options = cameraDevices.map((cam) => {
      return { value: cam.deviceId, label: cam.label }
    })
    setCameraOptions(options)
  }, [cameraDevices])

  useEffect(() => {
    if (!audioDevices) return
    setMicrophone({
      value: audioDevices[0].deviceId,
      label: audioDevices[0].label,
    })
    const options = audioDevices.map((aduio) => {
      return { value: aduio.deviceId, label: aduio.label }
    })
    setMicrophoneOptions(options)
  }, [audioDevices])

  return (
    <Modal
      open={open}
      onClose={async () => {
        handleClose()
      }}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-1/2',
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
      <Heading>Camera</Heading>
      <Select
        onChange={async (value) => {
          updateParticipant?.({ video: !constraints?.video })
          await mute('video')
          setcam(value)
        }}
        options={cameraoptions}
        isMulti={false}
        value={{
          value: cam?.value,
          label: cam?.label,
        }}
        placeholder="Camera"
      />
      <Heading>Microphone</Heading>
      <Select
        onChange={async (value) => {
          updateParticipant?.({ audio: !constraints?.audio })
          await mute('audio')
          setMicrophone(value)
        }}
        options={microphoneOptions}
        isMulti={false}
        value={{
          value: microphone?.value,
          label: microphone?.label,
        }}
        placeholder="MicroPhone"
      />
      <Button
        appearance="primary"
        type="button"
        onClick={async () => {
          setStudio({
            ...studio,
            selectedCameraDeviceId: cam?.value as string,
            selectedMicrophoneDeviceId: microphone?.value as string,
          })
          handleClose()
        }}
      >
        Select
      </Button>
    </Modal>
  )
}

export default SwitchMediaDevices
