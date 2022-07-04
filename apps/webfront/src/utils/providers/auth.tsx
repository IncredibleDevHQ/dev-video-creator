import axios from 'axios'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, User } from 'firebase/auth'
import { getDatabase, ref, onValue } from 'firebase/database'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getEnv } from '../hooks/useEnv'

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

const UserContext = createContext<
	Partial<{
		user: User | null
		setUser: (user: User | null) => void
		loadingUser: boolean
		token: string | null
	}>
>({})

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

	const token = await user.getIdToken(forceRefresh)
	const idTokenResult = await user.getIdTokenResult()
	const hasuraClaim = idTokenResult.claims['https://hasura.io/jwt/claims']

	if (hasuraClaim) {
		login(token)
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
