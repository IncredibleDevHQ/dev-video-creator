import { inferQueryInput, inferQueryOutput } from 'src/utils/trpc'

import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier'
import { Context } from '../createContext'
import appRouter from '../routes/route'

describe('server-tests', () => {
	describe('testing routes', () => {
		describe('router: users', () => {
			describe('Query: me', () => {
				// define context
				const ctx = {
					user: {
						sub: '123',
						email: 'test@mock.dev',
					} as DecodedIdToken,
				} as Context

				// create caller with the ctx
				const caller = appRouter.createCaller(ctx)

				// tests
				it('when `text` input is specified, echo back with user ctx(uid/sub) and `greetings {text}`', async () => {
					// Define input and target output
					const input: inferQueryInput<'user.me'> = {
						text: 'jest',
					}
					const output: inferQueryOutput<'user.me'> = {
						ctx: ctx.user!.sub,
						greeting: `hello ${input.text}`,
					}

					// make the query
					const me = await caller.query('user.me', input)

					// validate response
					expect(me).toMatchObject(output)
				})
				it('when no`text` input is specified, echo back with user ctx(uid/sub) and `greetings {email}', async () => {
					// Define input and target output
					const input: inferQueryInput<'user.me'> = {
						text: null,
					}
					const output: inferQueryOutput<'user.me'> = {
						ctx: ctx.user!.sub,
						greeting: `hello ${ctx.user!.email}`,
					}

					// make the query
					const me = await caller.query('user.me', input)

					// validate response
					expect(me).toMatchObject(output)
				})
			})
		})
	})
})
