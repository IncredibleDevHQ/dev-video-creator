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

import { inferQueryOutput } from 'src/server/trpc'
import { BrandingJSON } from 'src/utils/configs'
import { IntroBlockViewProps, TopLayerChildren } from 'utils/src'
import LowerThridProvider from './LowerThirdProvider'
import TransitionProvider from './TransitionProvider'

const GetTopLayerChildren = ({
	topLayerChildrenState,
	setTopLayerChildren,
	isShorts,
	theme,
	transitionSettings,
	branding,
	performFinishAction,
	introBlockViewProps,
	speakersLength,
}: {
	topLayerChildrenState: TopLayerChildren
	setTopLayerChildren: React.Dispatch<
		React.SetStateAction<{ id: string; state: TopLayerChildren }>
	>
	isShorts: boolean
	theme: inferQueryOutput<'util.themes'>[number]
	transitionSettings?: { blockTransition?: string; swapTransition?: string }
	branding?: BrandingJSON | null
	performFinishAction?: () => void
	introBlockViewProps?: IntroBlockViewProps
	speakersLength: number
}) => {
	switch (topLayerChildrenState) {
		case 'lowerThird': {
			return (
				<LowerThridProvider
					theme={theme}
					isShorts={isShorts || false}
					setTopLayerChildren={setTopLayerChildren}
					brandingJSON={branding}
					introBlockViewProps={introBlockViewProps}
					speakersLength={speakersLength}
				/>
			)
		}
		case 'transition left': {
			return (
				<TransitionProvider
					theme={theme}
					isShorts={isShorts || false}
					direction='left'
					setTopLayerChildren={setTopLayerChildren}
					brandingJSON={branding}
					transitionSettings={transitionSettings?.swapTransition}
				/>
			)
		}
		case 'transition right': {
			return (
				<TransitionProvider
					theme={theme}
					isShorts={isShorts || false}
					direction='right'
					setTopLayerChildren={setTopLayerChildren}
					brandingJSON={branding}
					transitionSettings={transitionSettings?.swapTransition}
				/>
			)
		}
		case 'transition moveIn': {
			return (
				<TransitionProvider
					theme={theme}
					isShorts={isShorts || false}
					direction='moveIn'
					setTopLayerChildren={setTopLayerChildren}
					performFinishAction={performFinishAction}
					brandingJSON={branding}
					transitionSettings={transitionSettings?.blockTransition}
				/>
			)
		}
		case 'transition moveAway': {
			return (
				<TransitionProvider
					theme={theme}
					isShorts={isShorts || false}
					direction='moveAway'
					setTopLayerChildren={setTopLayerChildren}
					brandingJSON={branding}
					transitionSettings={transitionSettings?.blockTransition}
				/>
			)
		}
		case '':
			return null
		default:
			return null
	}
}

export default GetTopLayerChildren
