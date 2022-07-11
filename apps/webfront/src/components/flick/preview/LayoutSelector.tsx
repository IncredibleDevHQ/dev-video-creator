/* eslint-disable no-nested-ternary */
import { css, cx } from '@emotion/css'
import { Block } from 'editor/src/utils/types'
import { useRecoilValue } from 'recoil'
import { ThemeFragment } from 'src/graphql/generated'
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
	theme?: ThemeFragment
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
