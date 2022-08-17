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
import { cx } from '@emotion/css'
import { HTMLProps } from 'react'

interface TextProps extends HTMLProps<HTMLParagraphElement> {
	textStyle?:
		| 'bodyStandard'
		| 'body'
		| 'bodySmall'
		| 'caption'
		| 'standardLink'
		| 'smallLink'
}

export const Text = ({
	textStyle,
	className,
	children,
	...rest
}: TextProps) => (
	<p
		className={cx(
			{
				'font-body text-size-md': textStyle === 'bodyStandard',
				'font-body text-size-sm-title': textStyle === 'body',
				'font-body text-size-xs': textStyle === 'caption',
				'font-body text-size-xxs': textStyle === 'bodySmall',
				'font-main text-size-sm': textStyle === 'standardLink',
				'font-main text-size-xs': textStyle === 'smallLink',
			},
			className
		)}
		{...rest}
	>
		{children}
	</p>
)

Text.defaultProps = {
	textStyle: 'bodyStandard',
}
