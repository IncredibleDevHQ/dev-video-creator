import {it,expect} from 'vitest'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {composePresenter} from '../render/presenter'
import {runCommand,probeSeconds} from './voice'
import type {Moment} from '../shared/model'
it('renders separate presenter footage without covering animation and retimes a longer take',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-presenter-fixture-'))
 try{
  const base=join(dir,'base.mp4'),camera=join(dir,'camera.mp4'),audio=join(dir,'audio.wav')
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','color=blue:s=320x180:r=30:d=1','-f','lavfi','-i','color=red:s=320x180:r=30:d=1','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-c:v','libx264',base])
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','color=lime:s=320x180:r=30:d=3','-c:v','libx264',camera])
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t','3',audio])
  const m=(id:string,start:number,end:number,on:boolean):Moment=>({id,start,end,camera:on?'full':'none',layout:'beside-slide',lines:'Synthetic fixture',overlay:null,recordingKey:'fixture',audioKey:'fixture',take:null,audio:null,media:{inputKey:'fixture',clips:[{start:0,end:end-start,camera:on}]}})
  const output=join(dir,'composed.mp4')
  await writeFile(output,await composePresenter({animation:await readFile(base),animationMoments:[{id:'a',start:0,end:1},{id:'b',start:1,end:2}],moments:[m('a',0,1,false),m('b',1,3,true)],audio:await readFile(audio),camera:await readFile(camera)}))
  expect(await probeSeconds(output)).toBeCloseTo(3,1)
  const pixel=async(at:number,x:number,y:number)=>{
   const path=join(dir,`pixel-${at}-${x}.rgb`)
   await runCommand('ffmpeg',['-y','-ss',String(at),'-i',output,'-frames:v','1','-vf',`crop=2:2:${x}:${y},scale=1:1`,'-pix_fmt','rgb24','-f','rawvideo',path])
   return [...await readFile(path)]
  }
  const first=await pixel(.5,960,540),content=await pixel(2,600,540),speaker=await pixel(2,1600,540)
  expect(first[2]).toBeGreaterThan(220);expect(content[0]).toBeGreaterThan(220);expect(speaker[1]).toBeGreaterThan(220)
  expect(content[1]).toBeLessThan(30);expect(speaker[0]).toBeLessThan(30)
 }finally{await rm(dir,{recursive:true,force:true})}
},30000)
