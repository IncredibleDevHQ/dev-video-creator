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
