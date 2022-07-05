import { S3 } from 'aws-sdk'

const s3 = new S3({
	accessKeyId: process.env.aws_accesskeyid,
	secretAccessKey: process.env.aws_secretaccesskey,
})

// eslint-disable-next-line import/prefer-default-export
export { s3 }
