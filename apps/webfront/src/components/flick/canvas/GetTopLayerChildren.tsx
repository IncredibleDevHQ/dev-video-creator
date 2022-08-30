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
