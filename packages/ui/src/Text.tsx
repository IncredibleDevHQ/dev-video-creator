/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import { HTMLProps } from 'react'

interface TextProps extends HTMLProps<HTMLParagraphElement> {
	textStyle?: 'bodyStandard' | 'body' | 'bodySmall' | 'caption'
}

export const Text = ({
	textStyle,
	className,
	children,
	...rest
}: TextProps) => (
	<p
		className={cx('font-body', {
			'text-size-md': textStyle === 'bodyStandard',
			'text-size-sm-title': textStyle === 'body',
			'text-size-xs': textStyle === 'caption',
			'text-size-xxs': textStyle === 'bodySmall',
		})}
		{...rest}
	>
		{children}
	</p>
)

Text.defaultProps = {
	textStyle: 'bodyStandard',
}
