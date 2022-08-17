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
import { createElement, HTMLProps } from 'react'

interface HeadingProps extends HTMLProps<HTMLHeadingElement> {
	as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
	textStyle?:
		| 'heading'
		| 'title'
		| 'mediumTitle'
		| 'smallTitle'
		| 'extraSmallTitle'
}

export const Heading = ({
	as,
	textStyle,
	children,
	className,
	...rest
}: HeadingProps) =>
	createElement(
		as || 'h2',
		{
			className: cx(
				'font-main',
				{
					'text-size-2xl': textStyle === 'heading',
					'text-size-xl': textStyle === 'title',
					'text-size-lg': textStyle === 'mediumTitle',
					'text-size-sm-title': textStyle === 'smallTitle',
					'text-size-xs-title': textStyle === 'extraSmallTitle',
				},
				className
			),
			...rest,
		},
		children
	)

Heading.defaultProps = {
	as: 'h2',
	textStyle: 'title',
}
