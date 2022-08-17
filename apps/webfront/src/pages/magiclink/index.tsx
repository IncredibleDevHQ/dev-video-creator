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

import axios from 'axios'
import {
	getAuth,
	isSignInWithEmailLink,
	signInWithEmailLink,
} from 'firebase/auth'
import { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { IoWarningOutline } from 'react-icons/io5'
import { useUser } from 'src/utils/providers/auth'
import { emitToast, Heading, ScreenState } from 'ui/src'

const MagicLink = (
	props: InferGetServerSidePropsType<typeof getServerSideProps>
) => {
	const { replace, query } = useRouter()
	const { user } = useUser()
	const [error, setError] = useState(false)

	const signIn = async () => {
		const { email } = props
		const auth = getAuth()
		try {
			if (isSignInWithEmailLink(auth, window.location.href)) {
				await signInWithEmailLink(auth, email, window.location.href)
			}
		} catch (e) {
			setError(true)
			emitToast(`Could not log you in. Please try again. ${e}`, {
				type: 'error',
			})
		}
	}

	useEffect(() => {
		signIn()
	}, [])

	useEffect(() => {
		if (user && user.onboarded) {
			if (query.redirectURI) {
				replace(query.redirectURI as string)
			} else if (query.error) {
				setError(true)
				emitToast(query.error as string, {
					type: 'error',
				})
			} else {
				replace('/dashboard')
			}
		}
	}, [user])

	if (error)
		return (
			<div className='flex flex-col gap-y-4 w-screen min-h-screen justify-center items-center'>
				<IoWarningOutline size={64} className='text-red-500' />
				<Heading textStyle='title'>
					We encountered an error. Please try again
				</Heading>
			</div>
		)

	return (
		<ScreenState
			title='Logging in'
			subtitle={query.redirectURI ? 'You will automatically be redirected' : ''}
		/>
	)
}

export const getServerSideProps: GetServerSideProps<{
	email: string
}> = async context => {
	try {
		const { state } = context.query

		const response = await axios.post(
			`${process.env.NEXT_PUBLIC_HASURA_REST}/fetchEmailFromState`,
			{
				state,
			},
			{
				headers: {
					'Content-Type': 'application/json',
				},
			}
		)

		const { email } = response.data.FetchEmailUsingState

		return {
			props: {
				email,
			},
		}
	} catch (e) {
		return {
			notFound: true,
		}
	}
}

export default MagicLink
