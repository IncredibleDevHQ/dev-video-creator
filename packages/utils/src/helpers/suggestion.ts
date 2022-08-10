import * as crypto from 'crypto'

export function generateSuggestionsFromEmail(email: string): string {
	const nameParts = email.replace(/@.+/, '')
	const name = nameParts.replace(/[&/\\#,+()$~%._@'":*?<>{}]/g, '')
	const suggestion = name + crypto.randomInt(100, 900).toString()

	return suggestion
}
