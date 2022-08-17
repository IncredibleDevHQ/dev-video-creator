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

/* eslint-disable react/jsx-no-constructed-context-values */
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { UploadType } from 'utils/src/enums'
import { useUser } from 'src/utils/providers/auth'
import Logo from 'svg/Logo.svg'
import { emitToast } from 'ui/src'
import trpc from '../../server/trpc'
import MainDetailsPage from './MainDetails'
import People from './People'
import PersonalDetailsPage from './PersonalDetails'
import { OnBoardingContext, OnBoardingProps, OnBoardingScreens } from './types'
import UploadPage from './Upload'

const OnBoarding = () => {
	const [activeScreen, setActiveScreen] = useState<OnBoardingScreens>(
		OnBoardingScreens.MainDetails
	)

	const { push } = useRouter()

	const { user, setUser } = useUser()

	const [details, setDetails] = useState<OnBoardingProps>({
		name: user?.displayName || '',
		username: user?.username || '',
		designation: user?.designation || '',
		organization: user?.organization || '',
		profilePicture: user?.picture || '',
	})

	const { mutateAsync: completeUserOnBoarding, isLoading: loading } =
		trpc.useMutation(['user.onboard'])

	useEffect(() => {
		setDetails({
			name: user?.displayName || '',
			username: user?.username || '',
			designation: user?.designation || '',
			organization: user?.organization || '',
			profilePicture: user?.picture || '',
		})
	}, [user])

	const handleOnBoarding = async () => {
		if (!details) return
		const { success } = await completeUserOnBoarding({
			...details,
		})
		if (success && setUser && user) {
			setUser(Object.assign(user, { onboarded: true }))
			emitToast('Successfully onboarded!', {
				type: 'success',
			})
			push('/dashboard')
		}
		if (!success) {
			emitToast('Something went wrong!', {
				type: 'error',
			})
		}
	}

	return (
		<OnBoardingContext.Provider
			value={{
				details,
				loading,
				activeScreen,
				setActiveScreen,
				setDetails,
				handleOnBoarding,
			}}
		>
			<section className='h-screen w-full flex flex-col justify-start items-center relative'>
				<Logo size='small' className='m-4 absolute top-0 left-0' />
				<People />

				{(() => {
					switch (activeScreen) {
						case OnBoardingScreens.MainDetails:
							return <MainDetailsPage />
						case OnBoardingScreens.PersonalDetails:
							return <PersonalDetailsPage />
						case OnBoardingScreens.Upload:
							return <UploadPage uploadTag={UploadType.Profile} />
						default:
							return null
					}
				})()}
			</section>
		</OnBoardingContext.Provider>
	)
}

export default OnBoarding
