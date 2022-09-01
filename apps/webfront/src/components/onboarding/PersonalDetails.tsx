// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { ChangeEvent, useContext } from 'react'
import { Heading, TextField, Button, Text } from 'ui/src'
import { OnBoardingContext, OnBoardingScreens } from './types'

const PersonalDetails = () => {
	const { details, setActiveScreen, setDetails } = useContext(OnBoardingContext)

	return (
		<form className='flex flex-col items-start h-full text-white w-full px-4 md:w-[450px] mt-16'>
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
