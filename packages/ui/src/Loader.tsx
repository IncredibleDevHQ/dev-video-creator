/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import { HTMLAttributes } from 'react'

export const Loader = ({
	className,
	...rest
}: HTMLAttributes<HTMLDivElement>) => (
	<div className={cx('loader', className)} {...rest} />
)
