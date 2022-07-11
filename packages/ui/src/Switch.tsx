/* eslint-disable react/require-default-props */
import { Switch as HeadlessSwitch } from '@headlessui/react'

export const Switch = ({
	label,
	checked,
	disabled,
	onChange,
}: {
	label?: string
	checked: boolean
	disabled?: boolean
	onChange: (checked: boolean) => void
}) => (
	<HeadlessSwitch.Group>
		<div className='flex items-center'>
			<HeadlessSwitch.Label className='mr-4'>{label}</HeadlessSwitch.Label>
			<HeadlessSwitch
				checked={checked}
				onChange={onChange}
				disabled={disabled}
				className={`${checked ? 'bg-green-600' : 'bg-gray-200'} ${
					disabled ? ' opacity-50' : ''
				} relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none disabled:cursor-not-allowed`}
			>
				<span
					className={`${
						checked ? 'translate-x-5' : 'translate-x-1'
					} inline-block w-3 h-3 transform bg-white rounded-full transition-transform`}
				/>
			</HeadlessSwitch>
		</div>
	</HeadlessSwitch.Group>
)
