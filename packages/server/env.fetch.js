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

const getSecrets = () => {
	const secrets = fs.readFileSync('./secrets.json')
	return JSON.parse(secrets)
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
			const secrets =
				process.env.DEPLOY_ENV === 'develop'
					? getSecrets()
					: await getDopplerSecrets()

			console.log('PREBUILD-WF : ENCRYPTING SECRETS ...')
			const rawSecrets = JSON.stringify(secrets)
			const encryptedSecrets = encryptEnv(rawSecrets)

			console.log('PREBUILD-WF : UPDATING SECRETS FILE...')
			fs.writeFileSync(
				'env.server.js',
				`// Do not modify, auto generated file \nmodule.exports = "${encryptedSecrets}"`
			)

			console.log('PREBUILD-WF : DONE!')
		} catch (e) {
			throw new Error('PREBUILD-WF : ERROR: ' + e)
		}
	})()
}
