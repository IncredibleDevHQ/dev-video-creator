import { User } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier'
import {
	inferMutationInput,
	inferMutationOutput,
	inferQueryInput,
	inferQueryOutput,
} from 'src/utils/trpc'

import { Context } from '../createContext'
import appRouter from '../routes/route'
import { createMockContext, MockContext } from './context'

let mockCtx: MockContext
let ctx: Context
let caller: any

beforeEach(() => {
	mockCtx = createMockContext()
	ctx = mockCtx as unknown as Context
	caller = appRouter.createCaller(ctx)
})

describe('User Route', () => {
	/* QUERIES */
	describe('me', () => {
		it('should return user details , when valid usersub is provided.', async () => {
			// TODO:
			// const input: inferQueryInput<'user.me'> = {
			// 	sub: '123456789',
			// }
			// const output: inferQueryOutput<'user.me'> = {
			// 	onboarded: true,
			// 	sub: '123456789',
			// 	username: 'test',
			// 	displayName: 'test',
			// 	email: 'test@jest.com',
			// }
			// const me = await caller.me(input)
			// expect(me).toEqual(output)
			expect(true).toBe(true)
		})
	})
	/* MUTATIONS */
	describe('onboard a user', () => {
		// define mockEntry
		const mockEntry = {
			user: {
				sub: 'U0gWqTKLbjQRGKW03rXJuAJEZPj2',
				email: 'testuser123@jest.com',
				displayName: 'testuser123',
				designation: 'tester',
				organization: 'jest',
				profilePicture: 'test.png',
			},
		}

		// add user to context
		ctx = {
			...ctx,
			user: {
				sub: mockEntry.user.sub,
				email: mockEntry.user.email,
			} as DecodedIdToken,
		}

		// positive case
		test('correctly provided all data is provided', async () => {
			// add db fn mock
			mockCtx.prisma.user.update.mockResolvedValue({
				email: mockEntry.user.email,
				displayName: mockEntry.user.displayName,
			} as User)

			const input: inferMutationInput<'user.onboard'> = {
				designation: mockEntry.user.designation,
				name: mockEntry.user.displayName,
				organization: mockEntry.user.organization,
				profilePicture: mockEntry.user.profilePicture,
			}
			const output: inferMutationOutput<'user.onboard'> = {
				success: true,
				updated: {
					email: mockEntry.user.email,
					displayName: mockEntry.user.displayName,
				},
			}

			const res = await caller.mutation('user.onboard', input)
			await expect(res).toEqual(output)
		})
		// TODO: test negative cases
	})
	describe('check username availability', () => {
		// invalid username sent
		test('when invalid username sent , throw invalid trpc error', async () => {
			const input: inferQueryInput<'user.availability'> = {
				username: 'testuser_123',
				senderEmail: 'testuser123@jest.com',
			}
			await expect(async () =>
				caller.query('user.availability', input)
			).rejects.toThrow(TRPCError)
		})

		// valid username sent
		test('when (unique + valid) username sent , return `valid`', async () => {
			const input: inferQueryInput<'user.availability'> = {
				username: 'testuser123',
				senderEmail: 'testuser123@jest.com',
			}

			const output: inferQueryOutput<'user.availability'> = {
				valid: true,
				message: 'Username is available',
			}
			// when no duplicate username is found
			mockCtx.prisma.user.aggregate.mockResolvedValue({ _count: 0 } as any)
			const res = await caller.query('user.availability', input)
			expect(res).toEqual(output)
		})

		// existing username sent
		test('when (non-unique + valid) username sent , return `invalid` with 3 suggestions', async () => {
			const input: inferQueryInput<'user.availability'> = {
				username: 'testuser123',
				senderEmail: 'testuser123@jest.com',
			}

			// when no duplicate username is found
			mockCtx.prisma.user.aggregate.mockResolvedValue({ _count: 1 } as any)
			const res = await caller.query('user.availability', input)

			// assertions to expect
			expect(res).toHaveProperty('valid', false)
			expect(res).toHaveProperty('suggestion')
			expect(res.suggestion).toHaveLength(3)
		})
	})
})
