'use strict'

const https = require('https')
const fs = require('fs')
const crypto = require('crypto')

const getDopplerSecrets = async () => {
	const dopplerToken = process.env.DOPPLER_TOKEN
	if (!dopplerToken) {
		throw new Error('DOPPLER_TOKEN is not set')
	}

	return new Promise(function (resolve, reject) {
		https
			.get(
				`https://${dopplerToken}@api.doppler.com/v3/configs/config/secrets/download?format=json`,
				res => {
					let secrets = ''
					res.on('data', data => (secrets += data))
					res.on('end', () => resolve(JSON.parse(secrets)))
				}
			)
			.on('error', e => reject(e))
	})
}

/* ref: https://gist.github.com/siwalikm/8311cf0a287b98ef67c73c1b03b47154#file-aes-256-cbc-js-L2 */
const encryptEnv = val => {
	const cipher = crypto.createCipheriv(
		process.env.ENV_ENCRYPTION_ALGORITHM || `aes-256-cbc`,
		process.env.ENCRYPTION_KEY, // process.env.ENC_KEY, generate using crypto.randomBytes(16).toString('hex')
		process.env.IV // process.env.IV?.toString() , generate using crypto.randomBytes(8).toString('hex')
	)
	let encrypted = cipher.update(val, 'utf8', 'base64')
	encrypted += cipher.final('base64')
	return encrypted
}

if (require.main === module) {
	console.log('PREBUILD-WF : RUNNING PREBUILD FOR WEBFRONT...')
	;(async () => {
		try {
			console.log('PREBUILD-WF : FETCHING SECRETS FROM DOPPLER ...')
			const secrets = await getDopplerSecrets()

			console.log('PREBUILD-WF : ENCRYPTING SECRETS ...')
			const rawSecrets = JSON.stringify(secrets)
			const encryptedSecrets = encryptEnv(rawSecrets)

			console.log('PREBUILD-WF : UPDATING SECRETS FILE...')
			fs.writeFileSync(
				'env.webfront.js',
				`// Do not modify, auto generated file \nmodule.exports = "${encryptedSecrets}"`
			)
			// fs.writeFileSync(
			// 	'../../packages/prisma/env.webfront.js',
			// 	`// Do not modify, auto generated file \nmodule.exports = "${encryptedSecrets}"`
			// )

			console.log('PREBUILD-WF : DONE!')
		} catch (e) {
			throw new Error('PREBUILD-WF : ERROR: ' + e)
		}
	})()
}
