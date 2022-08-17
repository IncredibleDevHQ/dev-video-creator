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
