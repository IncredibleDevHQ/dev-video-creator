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

/* eslint-disable no-nested-ternary */
import { css, cx } from '@emotion/css'
import { Block } from 'editor/src/utils/types'
import { useRecoilValue } from 'recoil'
import { inferQueryOutput } from 'src/server/trpc'
import { themeAtom } from 'src/stores/studio.store'
import {
	getThemeBasedIntroLayouts,
	getThemeSupportedUserMediaLayouts,
} from 'src/utils/canvasConfigs/themeConfig'
import {
	Layout,
	ViewConfig,
	outroLayoutTypes,
	shortsOutroLayoutTypes,
	shortsLayoutTypes,
} from 'utils/src'
import LayoutGeneric from './LayoutGeneric'

const scrollStyle = css`
	::-webkit-scrollbar {
		display: none;
	}
`

const LayoutSelector = ({
	type,
	mode,
	layout,
	theme,
	updateLayout,
	darkMode = false,
}: {
	layout: Layout
	mode: ViewConfig['mode']
	updateLayout: (layout: Layout) => void
	type: Block['type']
	theme?: inferQueryOutput<'util.themes'>[number]
	darkMode?: boolean
}) => {
	const activeTheme = useRecoilValue(themeAtom)

	const getLayouts = () => {
		switch (type) {
			case 'outroBlock':
				return outroLayoutTypes.map(layoutType => (
					<div className='flex items-center justify-center'>
						<LayoutGeneric
							type={type}
							key={layoutType}
							mode={mode}
							layout={layoutType}
							shouldDisplayIcon={false}
							isSelected={layout === layoutType}
							onClick={() => {
								updateLayout(layoutType)
							}}
							darkMode={darkMode}
						/>
					</div>
				))

			case 'introBlock':
				return getThemeBasedIntroLayouts(
					activeTheme?.name || 'DarkGradient'
				).map(layoutType => (
					<div className='flex items-center justify-center'>
						<LayoutGeneric
							type={type}
							key={layoutType}
							mode={mode}
							layout={layoutType}
							shouldDisplayIcon={false}
							isSelected={layout === layoutType}
							onClick={() => {
								updateLayout(layoutType)
							}}
							darkMode={darkMode}
						/>
					</div>
				))

			default:
				return getThemeSupportedUserMediaLayouts(
					theme?.name || activeTheme?.name || 'DarkGradient'
				).map(layoutType => (
					<div className='flex items-center justify-center'>
						<LayoutGeneric
							type={type}
							key={layoutType}
							mode={mode}
							layout={layoutType}
							isSelected={layout === layoutType}
							onClick={() => {
								updateLayout(layoutType)
							}}
							darkMode={darkMode}
						/>
					</div>
				))
		}
	}

	return (
		<div className={cx('h-full w-full overflow-y-scroll', scrollStyle)}>
			<div
				className={cx(
					'grid grid-cols-2 p-4 gap-4 overflow-scroll ',
					scrollStyle,
					{
						'w-full gap-2 grid-cols-3': mode === 'Portrait',
						'w-full gap-4': mode === 'Landscape',
					}
				)}
			>
				{mode === 'Landscape'
					? getLayouts()
					: type === 'outroBlock'
					? shortsOutroLayoutTypes?.map(layoutType => (
							<LayoutGeneric
								type={type}
								key={layoutType}
								mode={mode}
								layout={layoutType}
								isSelected={layout === layoutType}
								onClick={() => {
									updateLayout(layoutType)
								}}
								darkMode={darkMode}
							/>
					  ))
					: shortsLayoutTypes?.map(layoutType => (
							<LayoutGeneric
								type={type}
								key={layoutType}
								mode={mode}
								layout={layoutType}
								isSelected={layout === layoutType}
								onClick={() => {
									updateLayout(layoutType)
								}}
								darkMode={darkMode}
							/>
					  ))}
			</div>
		</div>
	)
}

export default LayoutSelector
