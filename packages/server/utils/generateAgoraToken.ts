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



import { RtcTokenBuilder, RtcRole } from 'agora-access-token'
import serverEnvs from './env'

const generateAgoraToken = (
	channelName: string,
	uid: string,
	role?: number
) => {
	const expirationTimeInSeconds = 3600

	const currentTimestamp = Math.floor(Date.now() / 1000)

	const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds
	const token = RtcTokenBuilder.buildTokenWithAccount(
		serverEnvs.AGORA_APP_ID,
		serverEnvs.AGORA_APP_CERTIFICATE,
		channelName,
		uid,
		role || RtcRole.PUBLISHER,
		privilegeExpiredTs
	)
	return { token, success: true }
}

export default generateAgoraToken
