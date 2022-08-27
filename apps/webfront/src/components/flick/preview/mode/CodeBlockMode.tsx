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
