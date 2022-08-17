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

import { IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng'
import { atom, atomFamily } from 'recoil'
import { inferQueryOutput } from 'src/server/trpc'
import {
	BrandingJSON,
	ControlsConfig,
	FragmentPayload,
} from 'src/utils/configs'
import { CodeTheme } from 'utils/src'

export type StudioState =
	| 'ready'
	| 'startRecording'
	| 'recording'
	| 'preview'
	| 'upload'
	| 'resumed'
	| 'countDown'
	| 'stopRecording'

export interface RTCUser extends IAgoraRTCRemoteUser {
	mediaStream?: MediaStream
}

export interface StudioProviderProps {
	isHost: boolean
	shortsMode?: boolean
}

export const studioStateAtom = atom<StudioState>({
	key: 'studioState',
	default: 'ready',
})

export const activeObjectIndexAtom = atom<number>({
	key: 'activeObjectIndex',
	default: 0,
})

export const themeAtom = atom<inferQueryOutput<'util.themes'>[number]>({
	key: 'theme',
	default: {
		name: 'DarkGradient',
		config: {},
	},
})

export const activeBrandIdAtom = atom<string | null>({
	key: 'activeBrandId',
	default: null,
})
export const brandingAtom = atom<BrandingJSON>({
	key: 'branding',
	default: {},
})

export type TransitionConfig = {
	swapTransition?: inferQueryOutput<'story.getTransitions'>[number]
	blockTransition?: inferQueryOutput<'story.getTransitions'>[number]
}
export const transitionAtom = atom<TransitionConfig>({
	key: 'transition',
	default: {},
})

// stores stream and audio from media
interface AgoraStreamData {
	stream: MediaStream
	audios: MediaStream[]
}
export const streamAtom = atom<AgoraStreamData | null>({
	key: 'stream',
	default: null,
})

// join , leave , renew in diff
interface AgoraActions {
	join: any
	leave: any
	renewToken: any
}

export const agoraActionsAtom = atom<AgoraActions | null>({
	key: 'agoraActions',
	default: null,
})

// user
export const agoraUsersAtom = atom<RTCUser[] | undefined>({
	key: 'agoraUsers',
	default: undefined,
})

// agora all channel users
export const agoraChannelUsersAtom = atom<RTCUser[] | null>({
	key: 'agoraChannelUsers',
})

export const payloadFamily = atomFamily<FragmentPayload, string>({
	key: 'payload',
	default: {},
})

export const controlsConfigAtom = atom<ControlsConfig>({
	key: 'controlsConfig',
	default: {},
})

export const isStudioControllerAtom = atom<boolean>({
	key: 'isStudioController',
	default: false,
})

export const recordingIdAtom = atom<string | undefined>({
	key: 'recordingId',
	default: undefined,
})

export const recordedBlocksAtom = atom<{ [key: string]: string }>({
	key: 'recordedBlocks',
	default: {},
})

export const codePreviewStore = atom<number>({
	key: 'codePreview',
	default: 0,
})

export const colorCodesAtom = atom<{
	[key: string]: {
		code: string | undefined
		colorCode: any
		theme: CodeTheme
	}
}>({
	key: 'colorCodes',
	default: {},
})

const studioAtom = atom<StudioProviderProps>({
	key: 'studio',
	default: {
		isHost: false,
		shortsMode: false,
	},
})

export default studioAtom
