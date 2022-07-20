import React, { ChangeEvent, useContext } from 'react'
import { Heading, TextField, Button, Text } from 'ui/src'
import { OnBoardingContext, OnBoardingScreens } from './types'

const PersonalDetails = () => {
	const { details, setActiveScreen, setDetails } = useContext(OnBoardingContext)

	return (
		<form className='flex flex-col items-start h-full text-white w-[450px] mt-16'>
			<Heading textStyle='mediumTitle'>What do you do</Heading>
			<Text textStyle='caption' className='mt-1 text-dark-title-200'>
				Your information will help us in giving you customized designs.
			</Text>
			<TextField
				autoFocus
				label='Designation'
				className='mt-4 mb-2'
				value={details.designation}
				required
				onChange={(e: ChangeEvent<HTMLInputElement>) => {
					setDetails({ ...details, designation: e.target.value })
				}}
			/>
			<TextField
				required
				label='Organization'
				className='mt-4 mb-2'
				value={details.organization}
				onChange={(e: ChangeEvent<HTMLInputElement>) => {
					setDetails({ ...details, organization: e.target.value })
				}}
			/>
			<Button
				className='max-w-none w-full mt-4'
				size='large'
				disabled={!details.designation || !details.organization}
				onClick={() => setActiveScreen(OnBoardingScreens.Upload)}
			>
				Next
			</Button>
		</form>
	)
}

export default PersonalDetails
