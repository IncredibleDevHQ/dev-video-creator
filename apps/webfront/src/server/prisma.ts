/**
 * Instantiates a single instance PrismaClient and save it on the global object.
 * @link https://www.prisma.io/docs/support/help-articles/nextjs-prisma-client-dev-practices
 */
import { PrismaClient } from '@prisma/client'
import serverEnvs from 'src/utils/env'

const prismaGlobal = global as typeof global & {
	prisma?: PrismaClient
}

const prisma: PrismaClient =
	prismaGlobal.prisma ||
	new PrismaClient({
		datasources: {
			db: { url: serverEnvs.DATABASE_URL },
		},
		log:
			serverEnvs.NODE_ENV === 'development' || !serverEnvs.NODE_ENV
				? ['query', 'error', 'warn']
				: ['error'],
	})

if (serverEnvs.NODE_ENV !== 'production') {
	prismaGlobal.prisma = prisma
}

export default prisma
