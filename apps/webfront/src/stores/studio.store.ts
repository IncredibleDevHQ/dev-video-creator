import { IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng'
import { atom, atomFamily } from 'recoil'
import { ThemeFragment } from 'src/graphql/generated'
import { BrandingJSON, FragmentPayload } from 'src/utils/configs'
import { CodeTheme } from 'utils/src'

export type StudioState =
	| 'ready'
	| 'start-recording'
	| 'recording'
	| 'preview'
	| 'upload'
	| 'resumed'
	| 'countDown'

export interface RTCUser extends IAgoraRTCRemoteUser {
	mediaStream?: MediaStream
}

export interface StudioProviderProps {
	users: RTCUser[]
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

export const brandingAtom = atom<BrandingJSON>({
	key: 'branding',
	default: {},
})

// stores the user media stream
export const streamAtom = atom<MediaStream | null>({
	key: 'stream',
	default: null,
})

export const payloadFamily = atomFamily<FragmentPayload, string>({
	key: 'payload',
	default: {},
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
		users: [],
		isHost: false,
		shortsMode: false,
	},
})

export default studioAtom
