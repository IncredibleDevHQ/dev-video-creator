import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {runCommand} from '../engine/voice'
/** Decode a real scene frame for the player's paused/loading cover. */
export async function videoCover(video:Buffer,second=1){
 const dir=await mkdtemp(join(tmpdir(),'studio-video-cover-'))
 try{
  const source=join(dir,'scene.mp4'),cover=join(dir,'cover.jpg')
  await writeFile(source,video)
  await runCommand('ffmpeg',['-y','-loglevel','error','-ss',String(Math.max(0,second)),'-i',source,'-frames:v','1','-vf','scale=960:-2','-q:v','2',cover],30000)
  return await readFile(cover)
 }finally{await rm(dir,{recursive:true,force:true})}
}
