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

import { S3 } from 'aws-sdk'
import serverEnvs from './env'

const s3 = new S3({
	accessKeyId: serverEnvs.AWS_ACCESS_KEY_ID,
	secretAccessKey: serverEnvs.AWS_SECRET_ACCESS_KEY,
})

// eslint-disable-next-line import/prefer-default-export
export { s3 }
