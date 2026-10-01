// Fresh Linux install from committed studio source only. No host volumes/keys/data.
import {execFile,spawn} from 'node:child_process'
import {promisify} from 'node:util'
import {randomUUID} from 'node:crypto'
import {fileURLToPath} from 'node:url'
const execute=promisify(execFile),cwd=fileURLToPath(new URL('..',import.meta.url))
const {stdout:prefix}=await execute('git',['rev-parse','--show-prefix'],{cwd})
const source=prefix.trim().replace(/\/$/,'')
if(!source)throw new Error('Run this check from the standalone studio folder in its Git checkout.')
const {stdout:archive}=await execute('git',['archive',`HEAD:${source}`],{cwd,encoding:'buffer',maxBuffer:64*1024*1024})
const {stdout:revision}=await execute('git',['rev-parse','HEAD'],{cwd})
const name=`studio-standalone-${randomUUID()}`
console.log(`Checking committed studio ${revision.trim()} in a fresh Linux container.`)
const script=`set -eu
mkdir /studio
tar -xf - -C /studio
cd /studio
echo 'Installing system prerequisites'
apt-get update -qq
apt-get install -y -qq ffmpeg python3 chromium >/tmp/system-install.log
echo 'Installing locked JavaScript dependencies'
yarn install --frozen-lockfile >/tmp/yarn-install.log 2>&1 || { tail -30 /tmp/yarn-install.log; exit 1; }
yarn run check
yarn build`
const child=spawn('docker',['run','--rm','-i','--name',name,'-e','PUPPETEER_SKIP_DOWNLOAD=true','-e','PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium','node:22-bookworm','bash','-lc',script],{stdio:['pipe','inherit','inherit']})
const stop=()=>{void execute('docker',['kill',name]).catch(()=>{});child.kill('SIGTERM')}
const timer=setTimeout(()=>{console.error('Fresh-container check exceeded 20 minutes.');stop()},20*60*1000)
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,stop)
child.stdin.on('error',()=>{});child.stdin.end(archive)
child.once('error',error=>{clearTimeout(timer);console.error(error.message);process.exitCode=1})
child.once('exit',code=>{clearTimeout(timer);process.exitCode=code ?? 1})
