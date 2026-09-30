// Inspect a retained local diagnostic without starting any generation.
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
const root=process.argv[2]
const live=process.argv.includes('--live')
const report=JSON.parse(await readFile(join(root,'diagnostic-report.json'),'utf8'))
if(report.storage!=='isolated-local-diagnostic-not-S3-proof')throw new Error('Choose an isolated diagnostic')
process.env.MINIMAL_STUDIO_DATA_DIR=root;process.env.MINIMAL_STUDIO_PERSISTENCE='local';if(!live)process.env.VITEST='read-only-review';delete process.env.MINIMAL_STUDIO_ALLOW_LIVE_HARNESS
process.env.OPENAI_API_KEY='';process.env.FISH_AUDIO_API_KEY='';delete process.env.MINIMAL_STUDIO_DATABASE_URL
const {createStudioServer}=await import('../engine/server.ts')
const server=createStudioServer({readOnly:!live})
const port=Number(process.env.MINIMAL_STUDIO_PORT || 4328)
process.env.MINIMAL_STUDIO_HARNESS_ORIGIN=`http://127.0.0.1:${port}`
server.listen(port,'127.0.0.1',()=>console.log(`${live?'Live':'Read-only'} local diagnostic API: http://127.0.0.1:${port}; notebook ${report.projectId}`))
let closing=false
const shutdown=async()=>{if(closing)return;closing=true;const {stopEngineRuns}=await import('../engine/harness/runtime.ts');await stopEngineRuns();server.closeAllConnections();server.close(()=>process.exit(0))}
process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown())
