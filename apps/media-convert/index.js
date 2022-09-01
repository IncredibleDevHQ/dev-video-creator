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

const { CompleteHandler } = require('./utils.js')

exports.handler = async event => {
	if (event.detail.queue !== process.env.MEDIA_QUEUE_ARN) {
		console.log('Invalid queue event. Skipping. eventdata = ', event)
		return
	}

	switch (event.detail.status) {
		case 'INPUT_INFORMATION':
			console.log(
				'jobId:' + event.detail.jobId + ' Transcoder has read the input info'
			)
			break

		case 'PROGRESSING':
			console.log('jobId:' + event.detail.jobId + ' progressing .... ')
			break

		case 'COMPLETE':
			console.log(
				'jobId:' + event.detail.jobId + ' successfully completed job.'
			)

			console.log('Detail : ', event.detail, '\t type = ', typeof event.detail)
			await CompleteHandler(event.detail.userMetadata)
			break

		case 'ERROR':
			console.log('jobId:' + event.detail.jobId + 'ERROR: ', event)
			break
	}

	return
}
