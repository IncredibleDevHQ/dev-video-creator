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
