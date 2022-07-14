import { IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng'
import { atom, atomFamily } from 'recoil'
import { ThemeFragment, TransitionFragment } from 'src/graphql/generated'
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

export const themeAtom = atom<ThemeFragment>({
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
	swapTransition?: TransitionFragment
	blockTransition?: TransitionFragment
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
export const agoraUsersAtom = atom<RTCUser[]>({
	key: 'agoraUsers',
	default: [],
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
