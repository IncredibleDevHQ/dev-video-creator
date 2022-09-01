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
