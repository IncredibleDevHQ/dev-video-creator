// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

import { useCallback, useEffect, useState } from 'react'

export type Device = {
	label: string
	id: string
}

type MediaStreamErrorName =
	| 'AbortError'
	| 'NotAllowedError'
	| 'NotFoundError'
	| 'NotReadableError'
	| 'OverconstrainedError'
	| 'TypeError'
	| 'UnknownError'
	| 'SecurityError'
	| 'PermissionDeniedError'
	| 'NoDeviceAvailableError'

export class MediaStreamError extends Error {
	name: MediaStreamErrorName

	constructor(name: MediaStreamErrorName) {
		super(name)
		this.name = name
	}
}

export interface UseMediaStream {
	microphone: Device | null
	camera: Device | null
	devices: {
		audioDevices: Device[]
		videoDevices: Device[]
	}
	setDevice: (type: 'microphone' | 'camera', device: Device) => void
	ready: boolean
	error: {
		camera: MediaStreamError | null
		microphone: MediaStreamError | null
	}
	permissions: {
		camera: PermissionState | null
		microphone: PermissionState | null
	}
	setError: React.Dispatch<
		React.SetStateAction<{
			camera: MediaStreamError | null
			microphone: MediaStreamError | null
		}>
	>
}

const useMediaStream = () => {
	const [microphone, setMicrophone] = useState<Device | null>(null)
	const [camera, setCamera] = useState<Device | null>(null)
	const [permissions, setPermissions] = useState<{
		camera: PermissionState | null
		microphone: PermissionState | null
	}>({ camera: null, microphone: null })

	const [ready, setReady] = useState(false)

	const [error, setError] = useState<{
		camera: MediaStreamError | null
		microphone: MediaStreamError | null
	}>({ camera: null, microphone: null })

	const [devices, setDevices] = useState<{
		audioDevices: Device[]
		videoDevices: Device[]
	}>({ audioDevices: [], videoDevices: [] })

	const getDevices = useCallback(async () => {
		// @ts-ignore
		navigator.permissions.query({ name: 'camera' }).then(result => {
			setPermissions(permission => ({
				...permission,
				camera: result.state,
			}))
		})

		// @ts-ignore
		navigator.permissions.query({ name: 'microphone' }).then(result => {
			setPermissions(permission => ({
				...permission,
				microphone: result.state,
			}))
		})

		try {
			await navigator.mediaDevices.getUserMedia({ video: true })
			setPermissions(permission => ({
				...permission,
				camera: 'granted',
			}))
			setError(err => ({ ...err, camera: null }))
		} catch (e) {
			const mediaStreamError = e as unknown as MediaStreamError
			if (mediaStreamError.name === 'NotAllowedError') {
				setPermissions(permission => ({
					...permission,
					camera: 'denied',
				}))
			}

			setError(err => ({ ...err, camera: mediaStreamError }))
		}

		try {
			await navigator.mediaDevices.getUserMedia({ audio: true })
			setPermissions(permission => ({
				...permission,
				microphone: 'granted',
			}))
			setError(err => ({ ...err, microphone: null }))
		} catch (e) {
			const mediaStreamError = e as unknown as MediaStreamError
			if (mediaStreamError.name === 'NotAllowedError') {
				setPermissions(permission => ({
					...permission,
					microphone: 'denied',
				}))
			}

			setError(err => ({ ...err, microphone: mediaStreamError }))
		}

		const mediaDevices = (
			await navigator.mediaDevices.enumerateDevices()
		).reverse()
		const audioDevices: Device[] = mediaDevices
			.filter(device => device.kind === 'audioinput')
			.map(device => ({ id: device.deviceId, label: device.label }))
		const videoDevices: Device[] = mediaDevices
			.filter(device => device.kind === 'videoinput')
			.map(device => ({ id: device.deviceId, label: device.label }))

		setDevices({ videoDevices, audioDevices })
	}, [])

	const setDevice = (type: 'microphone' | 'camera', device: Device) => {
		if (type === 'microphone') {
			setMicrophone(device)
		} else {
			setCamera(device)
		}
	}

	useEffect(() => {
		const init = async () => {
			await getDevices()
			setReady(true)
		}
		init()
	}, [])

	return {
		microphone,
		camera,
		devices,
		setDevice,
		ready,
		error,
		permissions,
		setError,
	} as UseMediaStream
}

export default useMediaStream
