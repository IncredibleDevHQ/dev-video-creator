import { PrismaClient } from '@prisma/client'
import { inferAsyncReturnType } from '@trpc/server'
import * as trpcNext from '@trpc/server/adapters/next'
import prisma from 'prisma-orm/prisma'
import { verifyCookie, verifyJwt } from './utils/jwt'

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface CreateContextOptions extends trpcNext.CreateNextContextOptions {
	prisma?: PrismaClient
}

async function getUserFromRequestHeader(authHeader: string) {
	const token = authHeader.split(' ')[1] // split by ' ' if Bearer is added
	if (token) {
		try {
			const v = await verifyJwt(token)
			return { ...v, token }
		} catch (e) {
			// TODO: Add logger
			return null
		}
	}
	return null
}

async function getUserFromSessionCookie(cookie: string) {
	try {
		const v = await verifyCookie(cookie)
		return v
	} catch (e) {
		console.log(e)
		return null
	}
}

/**
 * Inner function for `createContext` where we create the context.
 * This is useful for testing when we don't want to mock Next.js' request/response
 */
export async function createContextInner(
	_opts: CreateContextOptions,
	authHeader?: string,
	sessionCookie?: string
) {
	const user = authHeader ? await getUserFromRequestHeader(authHeader) : null
	return {
		..._opts,
		user,
		sessionCookie:
			user && sessionCookie
				? await getUserFromSessionCookie(sessionCookie)
				: null,
		prisma,
	}
}

export type Context = inferAsyncReturnType<typeof createContextInner>

export async function createContext(
	opts: trpcNext.CreateNextContextOptions
): Promise<Context> {
	const authHeader = opts.req.headers.authorization
	// eslint-disable-next-line no-underscore-dangle
	const sessionCookie = opts.req.headers['set-cookie']?.find(v =>
		v.includes('__session')
	)
	return createContextInner(opts, authHeader, sessionCookie)
}
