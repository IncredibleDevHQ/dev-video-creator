import { PrismaClient } from '@prisma/client'
import { inferAsyncReturnType } from '@trpc/server'
import * as trpcNext from '@trpc/server/adapters/next'
import verifyJwt from '../utils/jwt'
import prisma from './prisma'

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface CreateContextOptions extends trpcNext.CreateNextContextOptions {
	prisma?: PrismaClient
}

async function getUserFromRequestHeader(authHeader: string) {
	const token = authHeader.split(' ')[1] // split by ' ' if Bearer is added
	if (token) {
		try {
			const v = await verifyJwt(token)
			return v
		} catch (e) {
			// TODO: Add logger
			return null
		}
	}
	return null
}

/**
 * Inner function for `createContext` where we create the context.
 * This is useful for testing when we don't want to mock Next.js' request/response
 */
export async function createContextInner(
	_opts: CreateContextOptions,
	authHeader?: string
) {
	return {
		..._opts,
		user: authHeader ? await getUserFromRequestHeader(authHeader) : null,
		prisma,
	}
}

export type Context = inferAsyncReturnType<typeof createContextInner>

export async function createContext(
	opts: trpcNext.CreateNextContextOptions
): Promise<Context> {
	const authHeader = opts.req.headers.authorization
	return createContextInner(opts, authHeader)
}
