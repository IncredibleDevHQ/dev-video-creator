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



import axios from 'axios'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, User as FBUser } from 'firebase/auth'
import { getDatabase, onValue, ref } from 'firebase/database'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getEnv } from 'utils/src'
import trpc, { inferMutationOutput } from '../../server/trpc'

export const createFirebaseApp = () => {
	const { firebaseConfig } = getEnv()

	if (getApps().length <= 0) {
		initializeApp(firebaseConfig)
	}
}

const login = async (token: string) =>
	axios.post(
		'/api/login',
		{ idToken: token },
		{
			headers: {
				'Content-Type': 'application/json',
			},
			withCredentials: true,
		}
	)

type User = FBUser & Partial<inferMutationOutput<'user.me'>>

export const UserContext = createContext<
	Partial<{
		user: User | null
		setUser: (user: User | null) => void
		loadingUser: boolean
		token: string | null
	}>
>({})

const getDBUser = async (
	user: User,
	idToken: string,
	setUser: (user: User | null) => void
) => {
	const meResponse = await axios.post(
		`${process.env.NEXT_PUBLIC_BASE_URL}/api/trpc/user.me`,
		{
			json: {
				sub: user.uid,
			},
		},
		{
			headers: {
				Authorization: `Bearer ${idToken}`,
			},
		}
	)

	if (meResponse?.data?.result?.data?.json) {
		setUser(Object.assign(user, meResponse.data.result.data.json))
	}
}

const handleUser = async (
	user: User | null,
	setUser: (user: User | null) => void,
	setToken: (token: string | null) => void,
	setLoadingUser: (loading: boolean) => void,
	forceRefresh?: boolean
) => {
	if (!user) {
		setUser(null)
		setToken(null)
		setLoadingUser(false)
		return
	}

	const token = (await user.getIdToken?.(forceRefresh)) as string
	const idTokenResult = await user.getIdTokenResult?.()
	const hasuraClaim = idTokenResult?.claims['https://hasura.io/jwt/claims']

	if (hasuraClaim) {
		login(token)
		await getDBUser(user, token, setUser)
		setUser(user)
		setToken(token)
		setLoadingUser(false)
	} else {
		// Check if refresh is required.
		const db = getDatabase(getApp())
		const metadataRef = ref(db, `metadata/${user.uid}/refreshTime`)

		onValue(metadataRef, async snapshot => {
			if (!snapshot.exists) return
			handleUser(user, setUser, setToken, setLoadingUser, true)
		})
	}
}

const UserProvider = ({ children }: { children: React.ReactNode }) => {
	const [user, setUser] = useState<User | null>(null)
	const [token, setToken] = useState<string | null>(null)
	const [loadingUser, setLoadingUser] = useState(true)
	const trpcContext = trpc.useContext()

	useEffect(() => {
		createFirebaseApp()
		const auth = getAuth()
		const unsubscribe = onAuthStateChanged(auth, async authUser => {
			try {
				setLoadingUser(true)
				handleUser(authUser, setUser, setToken, setLoadingUser)
			} catch (error) {
				setLoadingUser(false)
			}
		})

		// Unsubscribe auth listener on unmount
		return () => unsubscribe()
	}, [])

	// update local storage on token refresh/change
	useEffect(() => {
		if (token && trpcContext && typeof window !== 'undefined') {
			localStorage.setItem('token', token)
			trpcContext.invalidateQueries()
		}
	}, [token, trpcContext])

	const value = useMemo(
		() => ({
			user,
			setUser,
			loadingUser,
			token,
		}),
		[user, setUser, loadingUser, token]
	)

	return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

// Custom hook that shorthands the context!
export const useUser = () => useContext(UserContext)

export default UserProvider
