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
