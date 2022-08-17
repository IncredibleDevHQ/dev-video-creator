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

import { cx } from '@emotion/css'
import { Heading, Text } from 'ui/src'
import { CodeBlockView, CodeTheme } from 'utils/src'

interface CodeThemeConfig {
	theme: CodeTheme
	name: string
	textColor: string
}

export const codeThemeConfig: CodeThemeConfig[] = [
	{
		theme: CodeTheme.Light,
		name: 'Light',
		textColor: '#000000',
	},
	{
		theme: CodeTheme.LightPlus,
		name: 'Light+',
		textColor: '#001081',
	},
	{
		theme: CodeTheme.QuietLight,
		name: 'Quiet Light',
		textColor: '#7A3F9D',
	},
	{
		theme: CodeTheme.SolarizedLight,
		name: 'Solarized Light',
		textColor: '#288DD2',
	},
	{
		theme: CodeTheme.Abyss,
		name: 'Abyss',
		textColor: '#6588CC',
	},
	{
		theme: CodeTheme.Dark,
		name: 'Dark',
		textColor: '#D4D5D4',
	},
	{
		theme: CodeTheme.DarkPlus,
		name: 'Dark+',
		textColor: '#9CDCFE',
	},
	{
		theme: CodeTheme.KimbieDark,
		name: 'Kimbie Dark',
		textColor: '#D3AF86',
	},
	{
		theme: CodeTheme.Monokai,
		name: 'Monokai',
		textColor: '#A6E22E',
	},
	{
		theme: CodeTheme.MonokaiDimmed,
		name: 'Monokai Dimmed',
		textColor: '#9872A2',
	},
	{
		theme: CodeTheme.Red,
		name: 'Red',
		textColor: '#FB9B4C',
	},
	{
		theme: CodeTheme.SolarizedDark,
		name: 'Solarized Dark',
		textColor: '#268BD2',
	},
	{
		theme: CodeTheme.TomorrowNightBlue,
		name: 'Tomorrow Night Blue',
		textColor: '#FF9EA4',
	},
	{
		theme: CodeTheme.HighContrast,
		name: 'High Contrast',
		textColor: '#9CDDFE',
	},
]

export const getSurfaceColor = ({ codeTheme }: { codeTheme: CodeTheme }) => {
	switch (codeTheme) {
		case 'light_vs':
			return '#ffffff'
		case 'light_plus':
			return '#ffffff'
		case 'quietlight':
			return '#f5f5f5'
		case 'solarized_light':
			return '#FDF6E3'
		case 'abyss':
			return '#000C18'
		case 'dark_vs':
			return '#1E1E1E'
		case 'dark_plus':
			return '#1E1E1E'
		case 'kimbie_dark':
			return '#221A0F'
		case 'monokai':
			return '#272822'
		case 'monokai_dimmed':
			return '#1E1E1E'
		case 'red':
			return '#390000'
		case 'solarized_dark':
			return '#002B36'
		case 'tomorrow_night_blue':
			return '#002451'
		case 'hc_black':
			return '#000000'
		default:
			return '#1E1E1E'
	}
}

const CodeBlockMode = ({
	view,
	updateView,
}: {
	view: CodeBlockView
	updateView: (view: CodeBlockView) => void
}) => (
	<div className='flex flex-col p-5'>
		{/* <Heading fontSize="small" className="font-bold">
        Code Style
      </Heading>
      <div className="mt-2 grid grid-cols-2 w-full gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={() => {
            updateView({
              ...view,
              code: {
                ...view.code,
                codeStyle: CodeStyle.Editor,
              },
            })
          }}
          className={cx('border border-gray-200 h-14 rounded-sm p-1', {
            'border-gray-800': view.code.codeStyle === CodeStyle.Editor,
          })}
        >
          <EditorStyleIcon className="w-full h-full" />
        </button>
        <button
          type="button"
          onClick={() => {
            updateView({
              ...view,
              code: {
                ...view.code,
                codeStyle: CodeStyle.Terminal,
              },
            })
          }}
          className={cx('border border-gray-200 h-14 rounded-sm p-1', {
            'border-gray-800': view.code.codeStyle === CodeStyle.Terminal,
          })}
        >
          <TerminalStyleIcon className="w-full h-full" />
        </button>
      </div> */}

		<Heading textStyle='extraSmallTitle' className='font-bold'>
			Code Theme
		</Heading>
		<div className='mt-2 grid grid-cols-2 gap-x-4 gap-y-3'>
			{codeThemeConfig.map((themeConfig, index) => (
				<button
					className={cx('border border-gray-200 h-14 rounded-sm p-1', {
						'border-gray-800': view.code.theme === themeConfig.theme,
					})}
					type='button'
					onClick={() => {
						updateView({
							...view,
							code: {
								...view.code,
								theme: themeConfig.theme,
							},
						})
					}}
					key={themeConfig.name}
				>
					<div
						style={{
							backgroundColor: getSurfaceColor({
								codeTheme: themeConfig.theme,
							}),
						}}
						className={cx(
							'border border-transparent w-full h-full flex items-center justify-center rounded-sm',
							{
								'border-gray-200': index === 0 || index === 1,
							}
						)}
					>
						<Text
							style={{
								fontFamily: 'Monaco',
								color: themeConfig.textColor,
							}}
							textStyle='bodySmall'
						>
							{themeConfig.name}
						</Text>
					</div>
				</button>
			))}
		</div>
	</div>
)

export default CodeBlockMode
