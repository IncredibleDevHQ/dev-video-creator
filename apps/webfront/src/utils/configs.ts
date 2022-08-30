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



import { RichTextContent } from 'editor/src/utils/types'
import { ClipConfig } from 'icanvas/src/hooks/useEdit'
import { Position } from 'src/components/flick/canvas/CodeAnimations'
import { ComputedRichText } from 'src/components/flick/canvas/RichText'
import { ComputedToken } from './hooks/useCode'
import { inferQueryOutput } from '../server/trpc'

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

export type BrandingInterface = Omit<
	inferQueryOutput<'user.brands'>[number],
	'branding'
> & {
	branding: BrandingJSON | null
}

// export interface BrandingInterface extends B {
// 	branding?: BrandingJSON | null
// }

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
	// actionTriggered?: string
}

export interface ControlsConfig {
	updatePayload?: (value: any) => void
	blockId?: string
	playing?: boolean
	videoElement?: HTMLVideoElement
	computedTokens?: ComputedToken[]
	position?: Position
	computedPoints?: ComputedPoint[]
}

// points configs
export interface ComputedPoint {
	y: number
	text: string
	width?: number
	height?: number
	level: number
	startFromIndex: number
	pointNumber: number
	content: {
		type: 'richText' | 'text'
		content: RichTextContent | string
		line: number
	}[]
	richTextData: ComputedRichText[]
}

// outro configs
export interface SocialHandles {
	twitterHandle?: string
	discordHandle?: string
	youtubeHandle?: string
	websiteHandle?: string
	linkedinHandle?: string
}
