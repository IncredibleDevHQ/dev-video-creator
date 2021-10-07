import { css, cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import Select from 'react-select'
import { useRecoilValue } from 'recoil'
import { Text, Loading } from '../../../components'
import { StudioProviderProps, studioStore } from '../stores'

const SwitchMediaDevices = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const {
    cameraDevice,
    microphoneDevice,
    getCameras,
    getMicrophones,
    updateCameraDevices,
    updateMicroPhoneDevices,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>()
  const [microphoneDevices, setMicrophoneDevices] =
    useState<MediaDeviceInfo[]>()

  useEffect(() => {
    if (!getCameras || !getMicrophones) return
    ;(async () => {
      try {
        const cDevices = await getCameras()
        const mDevices = await getMicrophones()
        setCameraDevices(cDevices)
        setMicrophoneDevices(mDevices)
      } catch (error) {
        console.error(error)
      }
    })()
  }, [getCameras, getMicrophones])

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
      {cameraDevices && microphoneDevices ? (
        <div>
          <Text>Camera</Text>
          <Select
            onChange={(device) => {
              if (!device) return
              const selectedCameraDevice = cameraDevices.find(
                (d) => d.deviceId === device.value
              )
              if (selectedCameraDevice)
                updateCameraDevices(selectedCameraDevice)
            }}
            options={cameraDevices.map((device) => {
              return {
                label: device.label,
                value: device.deviceId,
              }
            })}
            isMulti={false}
            value={{
              label: cameraDevice.label,
              value: cameraDevice.deviceId,
            }}
            placeholder="Camera"
          />
          <Text>Microphone</Text>
          <Select
            onChange={(device) => {
              if (!device) return
              const selectedMicrophoneDevice = microphoneDevices.find(
                (d) => d.deviceId === device.value
              )
              console.log('I set microphone', selectedMicrophoneDevice)
              if (selectedMicrophoneDevice)
                updateMicroPhoneDevices(selectedMicrophoneDevice)
            }}
            options={microphoneDevices.map((device) => {
              return {
                label: device.label,
                value: device.deviceId,
              }
            })}
            isMulti={false}
            value={{
              label: microphoneDevice.label,
              value: microphoneDevice.deviceId,
            }}
            placeholder="MicroPhone"
          />
        </div>
      ) : (
        <Loading />
      )}
    </Modal>
  )
}

export default SwitchMediaDevices
