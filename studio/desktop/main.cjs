const {app,BrowserWindow,dialog,shell}=require('electron')
const {spawn}=require('node:child_process')
const {resolve}=require('node:path')
const root=resolve(__dirname,'..')
const smoke=process.argv.includes('--smoke')
try{process.loadEnvFile(resolve(root,'.env'))}catch(error){if(error.code!=='ENOENT')throw error}
const webPort=Number(process.env.MINIMAL_STUDIO_WEB_PORT || 4180)
const enginePort=Number(process.env.MINIMAL_STUDIO_PORT || 4320)
const origin=`http://127.0.0.1:${webPort}`
let worker,window,quitting=false,workerExited=false
app.setName('Incredible Studio')
async function shutdown(){
 if(quitting)return;quitting=true
 if(worker && !workerExited){
  worker.kill('SIGTERM')
  await Promise.race([new Promise(resolve=>worker.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,10000))])
  if(!workerExited)worker.kill('SIGKILL')
 }
 app.exit(process.exitCode || 0)
}
app.on('before-quit',event=>{if(!quitting){event.preventDefault();void shutdown()}})
app.on('window-all-closed',()=>void shutdown())
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>void shutdown())
function external(url){
 try{const target=new URL(url);if(target.origin===origin)return false
  if(['https:','http:'].includes(target.protocol) && !['localhost','127.0.0.1','[::1]'].includes(target.hostname))void shell.openExternal(target.href)
 }catch{}
 return true
}
app.whenReady().then(async()=>{
 if(!process.env.STUDIO_NODE_PATH)throw new Error('Start desktop with yarn desktop.')
 for(const port of [webPort,enginePort])await new Promise((resolve,reject)=>{
  const probe=require('node:net').createServer();probe.once('error',()=>reject(new Error(`Port ${port} is already in use. Close the existing studio or choose different ports.`)));probe.listen(port,'127.0.0.1',()=>probe.close(resolve))
 })
 worker=spawn(process.env.STUDIO_NODE_PATH,['scripts/dev.mjs'],{cwd:root,env:process.env,stdio:'inherit'})
 worker.on('error',()=>{process.exitCode=1;void shutdown()})
 worker.on('exit',code=>{workerExited=true;if(!quitting){process.exitCode=code || 1;void shutdown()}})
 const deadline=Date.now()+45000
 while(!quitting){
  const ready=await Promise.all([origin,`http://127.0.0.1:${enginePort}/api/projects`].map(url=>fetch(url,{signal:AbortSignal.timeout(1000)}).then(response=>response.ok,()=>false)))
  if(ready.every(Boolean))break
  if(Date.now()>deadline)throw new Error('Studio did not start within 45 seconds. Check the terminal output.')
  await new Promise(resolve=>setTimeout(resolve,200))
 }
 if(quitting)return
 window=new BrowserWindow({width:1440,height:900,show:!smoke,backgroundColor:'#111719',webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}})
 window.webContents.session.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
  if(permission!=='media' || contents!==window.webContents || new URL(contents.getURL()).origin!==origin || details.isMainFrame===false){callback(false);return}
  const types=details.mediaTypes || []
  if(!types.length || types.some(type=>!['audio','video'].includes(type)) || smoke){callback(false);return}
  const devices=types.includes('video')?(types.includes('audio')?'camera and microphone':'camera'):'microphone'
  try{const result=await dialog.showMessageBox(window,{type:'question',title:'Recording permission',message:`Allow Incredible Studio to use your ${devices}?`,detail:'You can keep recording off and use a presenter avatar instead.',buttons:['Not now','Allow'],defaultId:0,cancelId:0});callback(result.response===1)}catch{callback(false)}
 })
 window.webContents.setWindowOpenHandler(({url})=>{external(url);return{action:'deny'}})
 window.webContents.on('will-navigate',(event,url)=>{if(external(url))event.preventDefault()})
 await window.loadURL(origin)
 if(smoke){console.log('Desktop smoke: app loaded; no device access or model calls requested.');await shutdown()}
}).catch(async error=>{console.error(error.message);process.exitCode=1;if(!smoke)dialog.showErrorBox('Incredible Studio could not start',error.message);await shutdown()})
