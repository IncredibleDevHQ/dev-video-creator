/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import { HTMLAttributes } from 'react'

const Label = ({
	className,
	...rest
}: HTMLAttributes<HTMLParagraphElement>) => (
	<small className={cx('font-main text-xs mb-1', className)} {...rest} />
)

export default Label
