import { ClipConfig } from 'icanvas/src/hooks/useEdit'

export const CONFIG = {
	width: 960,
	height: 540,
}

export const SHORTS_CONFIG = {
	width: 396,
	height: 704,
}

// Branding
export interface IFont {
	family: string
	type: 'google' | 'custom'
	url?: string
}

export interface BrandingJSON {
	colors?: {
		primary?: string
		secondary?: string
		tertiary?: string
		transition?: string
		text?: string
	}
	background?: {
		type?: 'image' | 'video' | 'color'
		url?: string
		color?: {
			primary?: string
			secondary?: string
			tertiary?: string
		}
	}
	logo?: string
	companyName?: string
	font?: {
		heading?: IFont
		body?: IFont
	}
	introVideoUrl?: string
	outroVideoUrl?: string
}

export type FragmentState = 'onlyUserMedia' | 'customLayout' | 'onlyFragment'

export interface StudioUserConfig {
	x: number
	y: number
	width: number
	height: number
	clipTheme?: string
	studioUserClipConfig?: ClipConfig
	borderColor?: string | CanvasGradient
	borderWidth?: number
	backgroundRectX?: number
	backgroundRectY?: number
	backgroundRectWidth?: number
	backgroundRectHeight?: number
	backgroundRectColor?: string
	backgroundRectOpacity?: number
	backgroundRectBorderRadius?: number
	backgroundRectBorderColor?: string
	backgroundRectBorderWidth?: number
	themeName?: string
}

export type FragmentPayload = {
	activeIntroIndex?: number
	activeOutroIndex?: number
	fragmentState?: FragmentState
	currentIndex?: number
	prevIndex?: number
	isFocus?: boolean
	focusBlockCode?: boolean
	activeBlockIndex?: number
	activePointIndex?: number
	currentTime?: number
	playing?: boolean
	zoomPointer?: {
		x: number
		y: number
	}
	shouldZoom?: boolean
	// actionTriggered?: string
}
