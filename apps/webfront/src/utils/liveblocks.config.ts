import { createClient, LiveMap, LiveObject } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'
import { BrandingFragment, ThemeFragment } from 'src/graphql/generated'
import { StudioState, TransitionConfig } from 'src/stores/studio.store'
import { getEnv, LiveViewConfig } from 'utils/src'
import { FragmentPayload } from './configs'

const client = createClient({
	publicApiKey: getEnv().liveblocks.publicKey,
})

// Presence represents the properties that will exist on every User in the Room
// and that will automatically be kept in sync. Accessible through the
// `user.presence` property. Must be JSON-serializable.
export enum PresencePage {
	Notebook = 'notebook',
	Preview = 'preview',
	Backstage = 'backstage',
	Recording = 'recording',
}
export type Presence = {
	user: {
		id: string
		name: string
		picture: string
	}
	page: PresencePage
	formatId?: string
	cursor: {
		x: number
		y: number
	}
	inHuddle: boolean
}

// Storage represents the shared document that persists in the
// Room, even after all Users leave. Fields under Storage typically are
// LiveList, LiveMap, LiveObject instances, for which updates are
// automatically persisted and synced to all connected clients.
type Storage = {
	viewConfig: LiveMap<string, LiveObject<LiveViewConfig>>
	// payload: LiveMap<string, LiveObject<FragmentPayload>>
	activeObjectIndex: LiveObject<{ activeObjectIndex: number }>
	// state: LiveObject<{ state: StudioState }>
	// recordedBlocks: LiveMap<string, string>
}

// Blank user meta for now
type UserMeta = {}

// The type of custom events broadcasted and listened for in this
// room. Must be JSON-serializable.
export enum RoomEventTypes {
	ThemeChanged = 'themeChanged',
	BrandingChanged = 'brandingChanged',
	TransitionChanged = 'transitionChanged',
	FlickNameChanged = 'flickNameChanged',
	PayloadChanged = 'payloadChanged',
	StateChanged = 'stateChanged',
	RetakeButtonClick = 'retakeButtonClick',
	SaveButtonClick = 'saveButtonClick',
	RequestControls = 'requestControls',
	ApproveRequestControls = 'approveRequestControls',
	RevokeControls = 'revokeControls',
	Zoom = 'zoom',
	UpdateRecordedBlocks = 'updateRecordedBlocks',
}
type RoomEvent =
	| {
			type: RoomEventTypes.ThemeChanged
			payload: ThemeFragment
	  }
	| {
			type: RoomEventTypes.BrandingChanged
			payload: BrandingFragment | null
	  }
	| {
			type: RoomEventTypes.TransitionChanged
			payload: TransitionConfig
	  }
	| {
			type: RoomEventTypes.FlickNameChanged
			payload: string
	  }
	| {
			type: RoomEventTypes.PayloadChanged
			payload: {
				blockId: string
				payload: FragmentPayload
			}
	  }
	| {
			type: RoomEventTypes.StateChanged
			payload: StudioState
	  }
	| {
			type: RoomEventTypes.RetakeButtonClick
			payload: any
	  }
	| { type: RoomEventTypes.SaveButtonClick; payload: any }
	| { type: RoomEventTypes.RequestControls; payload: { requestorSub: string } }
	| {
			type: RoomEventTypes.ApproveRequestControls
			payload: { requestorSub: string }
	  }
	| { type: RoomEventTypes.RevokeControls; payload: any }
	| {
			type: RoomEventTypes.Zoom
			payload: {
				zoomPointer: { x: number; y: number } | undefined
				shouldZoom: boolean
			}
	  }
	| {
			type: RoomEventTypes.UpdateRecordedBlocks
			payload: { [key: string]: string }
	  }

export const {
	RoomProvider,
	useMyPresence,
	useObject,
	useMap,
	useOthers,
	useUpdateMyPresence,
	useSelf,
	useStorage,
	useRoom,
	useBroadcastEvent,
	useEventListener,
} = createRoomContext<Presence, Storage, UserMeta, RoomEvent>(client)
