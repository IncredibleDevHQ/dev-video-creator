// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

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
