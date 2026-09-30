import {Pool} from 'pg'
import {S3Client} from '@aws-sdk/client-s3'
import type {RemoteStorageConfig} from './config'
const limits={connectMs:5000,queryMs:30000,requestMs:120000,idleMs:30000}
export const createStorageClients=(config:RemoteStorageConfig,timeouts=limits)=>({
 database:new Pool({connectionString:config.databaseUrl,max:5,connectionTimeoutMillis:timeouts.connectMs,query_timeout:timeouts.queryMs,statement_timeout:timeouts.queryMs}),
 objects:new S3Client({endpoint:config.endpoint,region:config.region,forcePathStyle:config.forcePathStyle,credentials:config.credentials,maxAttempts:2,requestHandler:{connectionTimeout:timeouts.connectMs,requestTimeout:timeouts.requestMs,throwOnRequestTimeout:true,socketTimeout:timeouts.idleMs},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'}),
})
