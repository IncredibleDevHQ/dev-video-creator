/* eslint-disable no-underscore-dangle */
import admin from 'firebase-admin'
import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier'
import { getAuth, signInWithCustomToken, User } from 'firebase/auth'
import { GetServerSidePropsContext, PreviewData } from 'next'
import { parseCookies } from 'nookies'
import { ParsedUrlQuery } from 'querystring'
import serverEnvs from 'server/utils/env'
import { createFirebaseApp } from '../providers/auth'

type SSRUserContext = GetServerSidePropsContext<ParsedUrlQuery, PreviewData> & {
	user: User | undefined
	userInfo: DecodedIdToken
}

const verifyCookie = async (
	cookie: string,
	requestUser: boolean
): Promise<{
	authenticated: boolean
	user: User | undefined
	userInfo: DecodedIdToken | undefined
}> => {
	try {
		if (!admin.apps.length) {
			admin.initializeApp({
				credential: admin.credential.cert(
					JSON.parse(serverEnvs.FIREBASE_SERVICE_CONFIG as string)
				),
			})
		}

		let user: User | undefined

		const decodedClaims = await admin
			.auth()
			.verifySessionCookie(cookie, true /** checkRevoked */)

		if (requestUser) {
			const customToken = await admin
				.auth()
				.createCustomToken(decodedClaims.sub)
			createFirebaseApp()
			user = (await signInWithCustomToken(getAuth(), customToken)).user
		}

		return {
			authenticated: true,
			user,
			userInfo: decodedClaims,
		}
	} catch (e) {
		return {
			authenticated: false,
			user: undefined,
			userInfo: undefined,
		}
	}
}

const requireAuth =
	(requestUser: boolean = false) =>
	(getServerSidePropsFunc: (context: SSRUserContext) => any) =>
	async (context: SSRUserContext) => {
		const redirect = {
			redirect: {
				permanent: false,
				destination: `/login?continue=${context.resolvedUrl}`,
			},
			props: {},
		}

		const cookies = parseCookies(context)
		if (!cookies.__session) return redirect

		const { authenticated, user, userInfo } = await verifyCookie(
			cookies.__session,
			requestUser
		)

		if (!authenticated || !userInfo) return redirect

		if (requestUser && !user) return redirect

		context.user = user
		context.userInfo = userInfo

		let returnData
		const composedProps = (await getServerSidePropsFunc(context)) || {}
		if (composedProps) {
			returnData = { ...composedProps }
		}
		return returnData
	}

export default requireAuth
