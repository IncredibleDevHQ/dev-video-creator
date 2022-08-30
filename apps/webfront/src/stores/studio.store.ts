// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.



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
