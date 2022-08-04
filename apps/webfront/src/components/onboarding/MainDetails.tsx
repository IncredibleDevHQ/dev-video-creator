/* eslint-disable no-nested-ternary */
import React, { useContext, useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import { Button, Heading, Text, TextField } from 'ui/src'
import trpc from 'server/trpc'
import { OnBoardingContext, OnBoardingScreens } from './types'

const MainDetails = () => {
	const { details, setActiveScreen, setDetails } = useContext(OnBoardingContext)
	const [localUsername] = useDebounce(details?.username, 500)

	const {
		refetch: isUsernameAvailable,
		data,
		error,
		isLoading: loading,
	} = trpc.useQuery(['user.availability', { username: localUsername }], {
		enabled: false,
	})

	useEffect(() => {
		if (localUsername) {
			isUsernameAvailable()
		}
	}, [localUsername])

	return (
		<form className='flex flex-col items-start h-full text-white w-[450px] mt-16'>
			<Heading textStyle='mediumTitle'>Tell us about yourself</Heading>
			<Text textStyle='caption' className='mt-1 text-dark-title-200'>
				Your information will help us in giving you customized designs.
			</Text>
			<TextField
				autoFocus
				label='Your name'
				className='mt-4 mb-2'
				value={details?.name}
				onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
					setDetails({ ...details, name: e.target.value })
				}
				required
			/>
			<TextField
				label='Username'
				className='mt-4 mb-2'
				value={details?.username}
				onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
					setDetails({ ...details, username: e.target.value })
				}
				caption={
					error?.message || (data ? (data.valid ? '' : 'Not available') : '')
				}
				required
			/>
			{data && !data?.valid && (
				<div className='flex justify-between items-center w-full text-size-xxs'>
					<span>You might like:</span>
					<button
						type='button'
						className='bg-dark-200 p-1 rounded-md text-gray-200 cursor-pointer'
						onClick={() =>
							setDetails({
								...details,
								username: data?.suggestion ?? '',
							})
						}
					>
						{data?.suggestion}
					</button>
				</div>
			)}
			<Button
				className='max-w-none w-full mt-4'
				size='large'
				disabled={
					loading || !details?.name || !details?.username || !data?.valid
				}
				onClick={() => setActiveScreen(OnBoardingScreens.PersonalDetails)}
			>
				Next
			</Button>
		</form>
	)
}

export default MainDetails
