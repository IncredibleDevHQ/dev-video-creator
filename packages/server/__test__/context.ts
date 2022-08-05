import { PrismaClient } from '@prisma/client'

// eslint-disable-next-line import/no-extraneous-dependencies, node/no-unpublished-import
import { mockDeep, DeepMockProxy } from 'jest-mock-extended'

export type MockContext = {
	req: any
	res: any
	user: any
	prisma: DeepMockProxy<PrismaClient>
}

export const createMockContext = (): MockContext => ({
	prisma: mockDeep<PrismaClient>(),
	req: {},
	res: {},
	user: {},
})
