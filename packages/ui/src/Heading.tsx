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
