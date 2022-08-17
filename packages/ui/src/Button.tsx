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
