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



/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/button-has-type */
import { cx } from '@emotion/css'
import { HTMLAttributes } from 'react'
import { FiLoader } from 'react-icons/fi'

type ColorScheme = 'green' | 'darkGreen' | 'dark' | 'darker'

interface ButtonProperties extends HTMLAttributes<HTMLButtonElement> {
	appearance?: 'solid' | 'none'
	colorScheme?: ColorScheme
	type?: 'button' | 'reset' | 'submit'
	leftIcon?: React.ReactElement
	rightIcon?: React.ReactElement
	onClick?: (e?: React.MouseEvent<HTMLElement>) => void
	size?: 'small' | 'large'
	loading?: boolean
	disabled?: boolean
}

export const Button = ({
	className,
	appearance,
	children,
	onClick,
	type,
	loading,
	disabled,
	size,
	leftIcon: LI,
	rightIcon: RI,
	colorScheme,
	...rest
}: ButtonProperties) => (
	<button
		className={cx(
			'group flex h-min max-w-max cursor-pointer items-center justify-center rounded-sm border border-transparent font-main font-semibold transition-all',

			// solid color schemes
			{
				'bg-green-600 text-dark-title hover:bg-green-500 transform active:scale-95 disabled:bg-green-600':
					appearance === 'solid' && colorScheme === 'green',
				'bg-green-700 text-dark-title hover:bg-green-800 transform active:scale-95 disabled:bg-green-700':
					appearance === 'solid' && colorScheme === 'darkGreen',
				'bg-dark-100 text-dark-title hover:bg-gray-600 transform active:scale-95 disabled:bg-dark-100':
					appearance === 'solid' && colorScheme === 'dark',
				'bg-dark-400 text-dark-title hover:bg-dark-300 transform active:scale-95 disabled:bg-dark-400':
					appearance === 'solid' && colorScheme === 'darker',
			},

			// sizes
			{
				'min-h-[40px] px-4 text-size-sm': size === 'large',
				'min-h-[32px] px-3 text-size-xs': size === 'small',
			},

			// appearance
			{
				'!p-0': appearance === 'none',
			},

			// rest
			{
				'cursor-not-allowed opacity-50': disabled,
				'cursor-not-allowed': loading,
			},
			className
		)}
		type={type}
		disabled={disabled || loading}
		onClick={e => !(disabled || loading) && onClick?.(e)}
		{...rest}
	>
		<FiLoader
			className={cx(
				'absolute animate-spin ',
				{
					'invisible ': !loading,
				},
				{
					'text-size-md': size === 'large',
					'text-size-sm': size === 'small',
				}
			)}
		/>
		<span
			className={cx('flex transform items-center justify-center gap-x-2', {
				'scale-0': loading,
				'scale-100': !loading,
			})}
		>
			{LI}
			{children}
			{RI}
		</span>
	</button>
)

Button.defaultProps = {
	appearance: 'solid',
	type: 'button',
	size: 'small',
	colorScheme: 'green',
	leftIcon: undefined,
	rightIcon: undefined,
	onClick: undefined,
	loading: undefined,
	disabled: undefined,
}
