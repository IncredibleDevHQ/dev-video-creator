
// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


const fetch = require('node-fetch')
const aws = require('aws-sdk')

const config = aws.config
config.update({ region: 'us-west-1' })

const kms = new aws.KMS({ apiVersion: '2014-11-01' })
const url = process.env.ENDPOINT
const encryptedSecret = process.env.SECRET || ''
const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME

const decryptUsingAwsKms = async encrypted => {
	// Decrypt code should run once and variables stored outside of the
	// function handler so that these are decrypted once per container

	try {
		const req = {
			CiphertextBlob: Buffer.from(encrypted, 'base64'),
			EncryptionContext: { LambdaFunctionName: functionName },
		}
		const data = await kms.decrypt(req).promise()
		return data.Plaintext.toString('ascii')
	} catch (err) {
		console.log('Decrypt error:', err)
		throw err
	}
}

const update = async data => {
	const secretHeader = await decryptUsingAwsKms(encryptedSecret)
	const headers = {
		'content-type': 'application/json',
		'x-secret': secretHeader,
	}

	const response = await fetch(url, {
		method: 'POST',
		headers: headers,
		body: JSON.stringify(data),
	})

	if (!response.status || response.status != 200) {
		console.error('Received non-200 http status from update Endpoint')
		throw new Error('Received non-200 http status from server!')
	}
	const status = await response.status()
	console.log(JSON.stringify({ status }))

	if (data !== 200) {
		throw new Error('Failed to update recording , ' + JSON.stringify(data))
	}
	return status
}

/*
    STATUS HANDLERS
*/

exports.CompleteHandler = async details => {
	const publishedAt = new Date().toISOString()
	console.log('setting pusblishedAt = ', publishedAt)
	console.log(
		'On complete : ',
		details.recordingId,
		'\n',
		details.flickId,
		'\n',
		details.outputKey,
		'\n'
	)

	const response = await update({
		recordingId: details.recordingId,
		outputKey: details.outputKey,
	})
	console.log(`updateRecording response: ${JSON.stringify(response)}`)
}
