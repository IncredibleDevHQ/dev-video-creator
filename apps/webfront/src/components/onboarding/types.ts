import { createContext } from 'react'

export enum OnBoardingScreens {
	MainDetails = 'main-details',
	PersonalDetails = 'personal-details',
	Upload = 'upload',
}

export interface OnBoardingProps {
	name: string
	username: string
	designation: string
	organization: string
	profilePicture: string
}

export const OnBoardingContext = createContext(
	{} as {
		details: OnBoardingProps
		activeScreen: OnBoardingScreens
		loading: boolean
		setActiveScreen: (screen: OnBoardingScreens) => void
		setDetails: (details: OnBoardingProps) => void
		handleOnBoarding: () => Promise<void>
	}
)
