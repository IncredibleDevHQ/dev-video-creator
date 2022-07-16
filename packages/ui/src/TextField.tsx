/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import { nanoid } from 'nanoid'
import { HTMLProps } from 'react'
import Label from './Label'

interface TextFieldProps extends HTMLProps<HTMLInputElement> {
	label?: string
	accessories?: JSX.Element[]
	caption?: JSX.Element | string
}

export const TextField = ({
	className,
	label,
	accessories,
	caption: C,
	...rest
}: TextFieldProps) => (
	<div className={cx('flex flex-col w-full', className)}>
		<Label>
			{label}
			{rest.required && <span className='ml-1'>*</span>}
		</Label>
		<div className='flex justify-between items-center rounded-md py-3 px-2 bg-dark-400 border border-transparent focus-within:border-green-600 focus-within:bg-dark-300 text-size-sm'>
			<input
				className='border-none outline-none flex-1 bg-transparent'
				{...rest}
			/>
			<div className='flex justify-between items-center'>
				{accessories?.map(accessory => (
					<span key={nanoid()}>{accessory}</span>
				))}
			</div>
		</div>
		{typeof C === 'string' ? (
			<span className='text-xs mt-1 font-semibold text-red-600 ml-auto'>
				{C}
			</span>
		) : (
			C
		)}
	</div>
)

TextField.defaultProps = {
	label: '',
	caption: undefined,
	accessories: undefined,
}
