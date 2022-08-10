import axios from 'axios'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, User as FBUser } from 'firebase/auth'
import { getDatabase, onValue, ref } from 'firebase/database'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getEnv } from 'utils/src'
import trpc, { inferQueryOutput } from '../../server/trpc'

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

type User = FBUser & Partial<inferQueryOutput<'user.me'>>

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
	const { hasura } = getEnv()
	const meResponse = await axios.post(
		`${hasura.restServer}/me`,
		{
			sub: user.uid,
		},
		{
			headers: {
				Authorization: `Bearer ${idToken}`,
			},
		}
	)
	if (meResponse.data?.User_by_pk) {
		setUser(Object.assign(user, meResponse.data?.User_by_pk))
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
