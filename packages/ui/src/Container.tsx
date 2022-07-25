/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import { HTMLAttributes } from 'react'

export const Container = ({
	className,
	...rest
}: HTMLAttributes<HTMLDivElement>) => (
	<div className={cx('px-5 py-2 md:p-6', className)} {...rest} />
)
