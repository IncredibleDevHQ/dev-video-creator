import * as aws from 'aws-sdk'
import serverEnvs from 'src/utils/env'
import {
	__mapOf__string,
	__listOfOutputGroup,
} from 'aws-sdk/clients/mediaconvert'
import { OrientationEnum } from './enums'

export const mediaConvertToMp4 = ({
	flickId,
	fragmentId,
	inputVideos,
	outputVideo,
	recordingId,
	orientation,
}: {
	flickId: string
	fragmentId: string
	inputVideos: string[]
	outputVideo: string
	recordingId: string
	orientation: OrientationEnum
}) => {
	const mc = new aws.MediaConvert({
		region: serverEnvs.AWS_MEDIA_CONVERT_REGION || 'us-west-1',
		endpoint: serverEnvs.AWS_MEDIA_CONVERT_ENDPOINT,
	})

	const inputs: aws.MediaConvert.Input[] = inputVideos.map(v => ({
		AudioSelectors: {
			'Audio Selector 1': {
				DefaultSelection: 'DEFAULT',
			},
		},
		VideoSelector: {},
		TimecodeSource: 'ZEROBASED',
		FileInput: `${serverEnvs.AWS_MEDIA_CONVERT_INPUT_BUCKET_URL}/${v}`,
	}))

	const userMeta: __mapOf__string = {
		env: serverEnvs.NODE_ENV ? 'production' : 'staging',
		outputKey: outputVideo,
		flickId,
		fragmentId,
		recordingId,
		orientation,
	}

	// ref doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-mediaconvert/modules/outputgroup.html
	const outputGroups: __listOfOutputGroup = [
		{
			// Custom name is just to view on console
			CustomName: `${serverEnvs.NODE_ENV}-gen-mp4`,
			// Name of output group
			Name: 'stitch-blocks',
			Outputs: [
				{
					// Container Format (MP4) settings
					ContainerSettings: {
						Container: 'MP4',
					},
					// Video settings
					VideoDescription: {
						CodecSettings: {
							Codec: 'H_264',
							H264Settings: {
								MaxBitrate:
									serverEnvs.AWS_MEDIA_CONVERT_MAX_BITRATE &&
									typeof serverEnvs.AWS_MEDIA_CONVERT_MAX_BITRATE
										? serverEnvs.AWS_MEDIA_CONVERT_MAX_BITRATE
										: 8000000,
								RateControlMode: 'QVBR',
								SceneChangeDetect: 'TRANSITION_DETECTION',
							},
						},
					},
					// Audio settings
					AudioDescriptions: [
						{
							CodecSettings: {
								Codec: 'AAC',
								AacSettings: {
									Bitrate: 96000,
									SampleRate: 48000,
									CodingMode: 'CODING_MODE_2_0',
								},
							},
							AudioNormalizationSettings: {
								Algorithm: 'ITU_BS_1770_2',
								AlgorithmControl: 'CORRECT_AUDIO',
								LoudnessLogging: 'DONT_LOG',
							},
						},
					],
				},
			],
			OutputGroupSettings: {
				Type: 'FILE_GROUP_SETTINGS',
				FileGroupSettings: {
					// TODO: The outputKey should not contain the file extension as it is added by the MediaConvert service.
					// In the future when we have multiple outputs of different format the lambda function will have to be updated to read event details and use
					// the corret outputKey.format combinations.
					// For now everything is mp4
					Destination: `${serverEnvs.AWS_MEDIA_CONVERT_OUTPUT_BUCKET_URL}/${
						userMeta.outputKey.split('.')[0]
					}`,
				},
			},
		} as aws.MediaConvert.OutputGroup,
	]

	const job = mc
		.createJob({
			Queue: serverEnvs.AWS_MEDIA_CONVERT_QUEUE,
			UserMetadata: userMeta,
			Role: serverEnvs.AWS_MEDIA_CONVERT_ROLE_ARN,
			Settings: {
				TimecodeConfig: {
					Source: 'ZEROBASED',
				},
				OutputGroups: outputGroups,
				Inputs: inputs,
			},
			AccelerationSettings: {
				Mode: 'DISABLED',
			},
			StatusUpdateInterval: 'SECONDS_30',
			Priority: 0,
		})
		.promise()

	return job
}

export default mediaConvertToMp4
