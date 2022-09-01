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
