import { RtcTokenBuilder, RtcRole } from 'agora-access-token'
import serverEnvs from 'src/utils/env'

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
