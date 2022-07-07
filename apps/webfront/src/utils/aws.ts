import { S3 } from 'aws-sdk'
import serverEnvs from './env'

const s3 = new S3({
	accessKeyId: serverEnvs.AWS_ACCESS_KEY_ID,
	secretAccessKey: serverEnvs.AWS_SECRET_ACCESS_KEY,
})

// eslint-disable-next-line import/prefer-default-export
export { s3 }
