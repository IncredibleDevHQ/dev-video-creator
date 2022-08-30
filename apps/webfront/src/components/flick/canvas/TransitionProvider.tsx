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



import React from 'react'
import { useRecoilValue } from 'recoil'
import { inferQueryOutput } from 'src/server/trpc'
import { brandingAtom } from 'src/stores/studio.store'
import { BrandingJSON } from 'src/utils/configs'
import { TopLayerChildren } from 'utils/src'

import {
	RainbowTransition,
	DevsForUkraineTransition,
	DipTransition,
	MidnightTransition,
	PastelLinesTransition,
	VelvetTransition,
	TrianglePathTransition,
	CardinalTransition,
	ObsidianTransition,
} from './Transitions'

const TransitionProvider = ({
	theme,
	isShorts,
	direction,
	setTopLayerChildren,
	performFinishAction,
	brandingJSON,
	transitionSettings,
}: {
	theme: inferQueryOutput<'util.themes'>[number]
	isShorts: boolean
	direction: string
	setTopLayerChildren?: React.Dispatch<
		React.SetStateAction<{ id: string; state: TopLayerChildren }>
	>
	performFinishAction?: () => void
	brandingJSON?: BrandingJSON | null
	transitionSettings?: string
}) => {
	const branding = useRecoilValue(brandingAtom) || brandingJSON
	if (transitionSettings && !isShorts) {
		switch (transitionSettings) {
			case 'Circles':
				return (
					<DevsForUkraineTransition
						direction={direction}
						// isShorts={isShorts}
						// color="white"
						setTopLayerChildren={setTopLayerChildren}
						performFinishAction={performFinishAction}
					/>
				)
			case 'DipToBlack':
				return (
					<DipTransition
						direction={direction}
						isShorts={isShorts}
						color='black'
						performFinishAction={performFinishAction}
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'DipToWhite':
				return (
					<DipTransition
						direction={direction}
						isShorts={isShorts}
						color='white'
						performFinishAction={performFinishAction}
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'Line':
				return (
					<PastelLinesTransition
						direction={direction}
						isShorts={isShorts}
						color={branding?.colors?.transition}
						setTopLayerChildren={setTopLayerChildren}
						performFinishAction={performFinishAction}
					/>
				)
			case 'Rectangles':
				return (
					<ObsidianTransition
						direction={direction}
						isShorts={isShorts}
						// color="black"
						setTopLayerChildren={setTopLayerChildren}
						performFinishAction={performFinishAction}
					/>
				)
			case 'Triangles':
				return (
					<TrianglePathTransition
						direction={direction}
						isShorts={isShorts}
						color={branding?.colors?.transition}
						performFinishAction={performFinishAction}
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'Wipe':
				return (
					<MidnightTransition
						direction={direction}
						isShorts={isShorts}
						// color={branding?.colors?.transition}
						setTopLayerChildren={setTopLayerChildren}
						performFinishAction={performFinishAction}
					/>
				)
			case 'CloseSides':
				return (
					<CardinalTransition
						direction={direction}
						isShorts={isShorts}
						// color="black"
						setTopLayerChildren={setTopLayerChildren}
						performFinishAction={performFinishAction}
					/>
				)
			default:
				return null
		}
	} else {
		switch (theme.name) {
			case 'DarkGradient':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='black'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<TrianglePathTransition
						direction={direction}
						isShorts={isShorts}
						color={branding?.colors?.transition}
						performFinishAction={performFinishAction}
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'PastelLines':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='black'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<PastelLinesTransition
						direction={direction}
						isShorts={isShorts}
						color={branding?.colors?.transition}
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'Rainbow':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='white'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<RainbowTransition
						direction={direction}
						isShorts={isShorts}
						color={branding?.colors?.transition}
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'Iceberg':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='white'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<DipTransition
						direction={direction}
						isShorts={isShorts}
						color='white'
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'Midnight':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='black'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					// <MidnightTransition
					//   direction={direction}
					//   isShorts={isShorts}
					//   // color={branding?.colors?.transition}
					//   setTopLayerChildren={setTopLayerChildren}
					// />
					<DipTransition
						direction={direction}
						isShorts={isShorts}
						color='black'
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'Spiro':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='black'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<TrianglePathTransition
						direction={direction}
						isShorts={isShorts}
						color={branding?.colors?.transition}
						performFinishAction={performFinishAction}
					/>
					// <SpiroTransition
					//   direction={direction}
					//   // isShorts={isShorts}
					//   // color={branding?.colors?.transition}
					//   setTopLayerChildren={setTopLayerChildren}
					// />
				)
			case 'DevsForUkraine':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='black'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<DevsForUkraineTransition
						direction={direction}
						// isShorts={isShorts}
						// color="white"
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'Obsidian':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='black'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<ObsidianTransition
						direction={direction}
						isShorts={isShorts}
						// color="black"
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'Cardinal':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='black'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<CardinalTransition
						direction={direction}
						isShorts={isShorts}
						// color="black"
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'Velvet':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='black'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<VelvetTransition
						direction={direction}
						isShorts={isShorts}
						// color="black"
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'CherryBlossom':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='white'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<DipTransition
						direction={direction}
						isShorts={isShorts}
						color='white'
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			case 'Lilac':
				if (direction === 'moveIn' || direction === 'moveAway') {
					return (
						<DipTransition
							direction={direction}
							isShorts={isShorts}
							color='black'
							performFinishAction={performFinishAction}
							setTopLayerChildren={setTopLayerChildren}
						/>
					)
				}
				return (
					<DipTransition
						direction={direction}
						isShorts={isShorts}
						color='black'
						setTopLayerChildren={setTopLayerChildren}
					/>
				)
			default:
				return null
		}
	}
}

export default TransitionProvider
