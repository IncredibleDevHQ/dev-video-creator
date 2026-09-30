import { afterAll, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Project, Scene } from '../shared/model'
const root = await mkdtemp(join(tmpdir(), 'minimal-render-check-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { storeAsset } = await import('../engine/persistence')
const { runCommand } = await import('../engine/voice')
const { buildSceneBundle } = await import('../render/scene')
const { renderProductionBundle } = await import('../render/production-render')
afterAll(() => rm(root, { recursive: true, force: true }))
it('renders the actual Hyperframes composition with picture and sound', async () => {
  const sound = join(root,'fixture.wav')
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1.5',sound])
  const asset = await storeAsset({body:await readFile(sound),contentType:'audio/wav',kind:'test-fixture',extension:'.wav'})
  const scene: Scene = {id:'scene-test',slideId:'slide-test',phase:'producing',presence:null,inputKey:'scene-input',produced:null,error:null,moments:[{id:'moment-test',lines:'Synthetic render check.',start:0,end:1.5,camera:'none',layout:'corner',overlay:null,recordingKey:'recording',take:null,audioKey:'audio-input',audio:{inputKey:'audio-input',objectKey:asset.objectKey,duration:1.5},media:{inputKey:'audio-input',clips:[{start:0,end:1.5,camera:false}]}}]}
  const project: Project = {id:'project-test',title:'Synthetic render check',source:'Fixture',slides:[{id:'slide-test',title:'Fixture',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#206040"/><text x="200" y="540" font-size="90" fill="white">Synthetic render check</text></svg>'}],video:null}
  const output = join(root,'scene.mp4')
  await writeFile(output,await renderProductionBundle(await buildSceneBundle(project,scene),{fps:30}))
  const result = JSON.parse(await runCommand('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output]))
  expect(result.streams.map((stream: {codec_type: string}) => stream.codec_type)).toEqual(expect.arrayContaining(['video','audio']))
  expect(Number(result.format.duration)).toBeCloseTo(1.5,1)
  const { stdout:pixel } = await promisify(execFile)('ffmpeg',['-v','error','-ss','0.7','-i',output,'-vf','crop=1:1:100:100,format=rgb24','-frames:v','1','-f','rawvideo','-'],{encoding:'buffer'})
  expect(pixel.length).toBe(3)
  expect(pixel[1]).toBeGreaterThan(70)
  expect(pixel[1]).toBeGreaterThan(pixel[0]*2)
},120000)

it('renders camera windows at the right scene times, including a later moment',async () => {
  const fixture=join(root,'camera.mp4')
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','color=c=red:s=160x90:r=30','-t','2','-c:v','libx264','-pix_fmt','yuv420p',fixture])
  const camera=await storeAsset({body:await readFile(fixture),contentType:'video/mp4',kind:'test-fixture',extension:'.mp4'})
  const sound=join(root,'two-seconds.wav')
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1',sound])
  const audio=await storeAsset({body:await readFile(sound),contentType:'audio/wav',kind:'test-fixture',extension:'.wav'})
  const scene: Scene={id:'window-scene',slideId:'slide',phase:'producing',presence:null,inputKey:'input',produced:null,error:null,moments:[0,1].map(index => ({id:`moment-${index}`,lines:'Synthetic camera check.',start:index,end:index+1,camera:index?'start':'none',layout:'full-screen',overlay:null,recordingKey:'record',take:null,audioKey:'audio',audio:{inputKey:'audio',objectKey:audio.objectKey,duration:1},media:{inputKey:'audio',clips:index?[{start:0,end:.4,camera:true,videoKey:camera.objectKey,videoFrom:.3},{start:.4,end:1,camera:false}]:[{start:0,end:1,camera:false}]}}))}
  const project: Project={id:'camera-test',title:'Synthetic camera check',source:'Fixture',video:null,slides:[{id:'slide',title:'Fixture',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#206040"/></svg>'}]}
  const output=join(root,'window-scene.mp4')
  await writeFile(output,await renderProductionBundle(await buildSceneBundle(project,scene),{fps:30}))
  const pixel=async (second: number) => (await promisify(execFile)('ffmpeg',['-v','error','-ss',String(second),'-i',output,'-vf','crop=1:1:100:100,format=rgb24','-frames:v','1','-f','rawvideo','-'],{encoding:'buffer'})).stdout
  for (const second of [.7,1.8]) {const color=await pixel(second);expect(color[1],`green slide at ${second}s`).toBeGreaterThan(color[0]*2)}
  const shown=await pixel(1.1);expect(shown[0],'red recorded camera at 1.1s').toBeGreaterThan(180);expect(shown[1]).toBeLessThan(20)
},120000)

it('renders saved logo and presenter branding into the title scene',async () => {
  const logoPath=join(root,'logo.png')
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','color=c=yellow:s=100x100','-frames:v','1',logoPath])
  const logo=await storeAsset({body:await readFile(logoPath),contentType:'image/png',kind:'test-fixture',extension:'.png'})
  const sound=join(root,'branded.wav')
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1',sound])
  const audio=await storeAsset({body:await readFile(sound),contentType:'audio/wav',kind:'test-fixture',extension:'.wav'})
  const scene:Scene={id:'branded-scene',slideId:'slide',phase:'producing',presence:null,inputKey:'input',produced:null,error:null,moments:[{id:'moment',lines:'Synthetic branding check.',start:0,end:1,camera:'none',layout:'corner',overlay:'title-card',recordingKey:'record',take:null,audioKey:'audio',audio:{inputKey:'audio',objectKey:audio.objectKey,duration:1},media:{inputKey:'audio',clips:[{start:0,end:1,camera:false}]}}]}
  const project:Project={id:'branded',title:'Synthetic branding check',source:'Fixture',video:null,branding:{name:'Sam',tagline:'Engineering',accent:'#ff00ff',useAccent:true,logoKey:logo.objectKey},slides:[{id:'slide',title:'Fixture',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#206040"/></svg>'}]}
  const output=join(root,'branded.mp4')
  await writeFile(output,await renderProductionBundle(await buildSceneBundle(project,scene),{fps:30}))
  const pixel=async(x:number,y:number)=>(await promisify(execFile)('ffmpeg',['-v','error','-ss','0.5','-i',output,'-vf',`crop=1:1:${x}:${y},format=rgb24`,'-frames:v','1','-f','rawvideo','-'],{encoding:'buffer'})).stdout
  const logoColor=await pixel(120,100);expect(logoColor[0]).toBeGreaterThan(200);expect(logoColor[1]).toBeGreaterThan(200);expect(logoColor[2]).toBeLessThan(30)
  const accent=await pixel(93,920);expect(accent[0]).toBeGreaterThan(180);expect(accent[2]).toBeGreaterThan(180);expect(accent[1]).toBeLessThan(40)
},120000)
