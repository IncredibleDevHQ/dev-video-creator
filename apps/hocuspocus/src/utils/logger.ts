import * as Sentry from '@sentry/node'

const now = () => new Date().toISOString()

class Logger {
	static log(message: string) {
		console.log(`[${now()}] ${message}`)
	}

	static error(message: string, context?: any) {
		Sentry.captureException(new Error(message), {
			contexts: context?.invocationId
				? {
						invocationId: context.invocationId,
				  }
				: undefined,
			user: context?.user
				? {
						id: context.user.id,
						email: context.user.email,
				  }
				: undefined,
		})
		console.error(`[${now()}] ${message}`)
	}
}

export default Logger
