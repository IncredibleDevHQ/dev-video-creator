import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll,expect,it,vi } from 'vitest'
import type { Snapshot } from '../shared/api'
vi.mock('./voice-library',() => ({listClones:async()=>[],voiceCatalogue:async()=>({choices:[],error:null}),selectedVoice:async()=>({kind:'record'}),useVoice:vi.fn()}))
const root=await mkdtemp(join(tmpdir(),'minimal-settings-'))
process.env.MINIMAL_STUDIO_DATA_DIR=root
const {getStudioSettings,saveStudioSettings}=await import('./settings')
const {configureModelGateway}=await import('./model-gateway')
const {writeRow}=await import('./persistence')
const {loadProject}=await import('./projects')
const {refreshVideoKeys}=await import('./scene-model')
configureModelGateway({envKey:''})
afterAll(() => rm(root,{recursive:true,force:true}))
it('reports saved credentials without returning their contents or hints',async () => {
  const settings=await saveStudioSettings({models:{provider:'custom',baseUrl:'http://127.0.0.1:1234/v1',apiKey:'test-model-secret',models:{writing:'write',vision:'see',coding:'code'}},fishApiKey:'test-fish-secret'})
  expect(settings.models.hasKey).toBe(true);expect(settings.voice.hasKey).toBe(true)
  const response=JSON.stringify(await getStudioSettings())
  expect(response).not.toContain('test-model-secret');expect(response).not.toContain('test-fish-secret');expect(response).not.toContain('keyHint')
})
it('branding changes invalidate scene and whole-video exports',async () => {
  const snapshot:Snapshot={project:{id:'brand',title:'Fixture',source:'Fixture',slides:[{id:'slide',title:'Fixture',svg:'<svg><rect fill="#112233"/></svg>'}],video:{settings:{presence:'off',voice:{kind:'record'}},inputKey:'',scenes:[{id:'scene',slideId:'slide',phase:'produced',presence:null,inputKey:'',moments:[{id:'moment',lines:'Fixture',start:0,end:2,camera:'none',layout:'corner',overlay:null,recordingKey:'record',take:{id:'take',recordingKey:'record',objectKey:'take.webm'},audio:null,audioKey:'audio'}],produced:null,error:null}],transitions:[],produced:null}},status:'ready',events:[],error:null}
  refreshVideoKeys(snapshot.project)
  const scene=snapshot.project.video!.scenes[0];scene.produced={inputKey:scene.inputKey,objectKey:'scene.mp4'}
  snapshot.project.video!.produced={inputKey:snapshot.project.video!.inputKey,objectKey:'video.mp4'}
  await writeRow('outlines','brand',{brand:{accent:'#112233'}})
  await writeRow('projects','brand',snapshot)
  const old=(await loadProject('brand'))!
  expect(old.views!.video.action).toBe('export')
  await saveStudioSettings({branding:{name:'Sam',tagline:'Engineering',accent:'#234567',useAccent:true,logoKey:null},projectId:'brand'})
  const changed=(await loadProject('brand'))!
  expect(changed.project.branding?.name).toBe('Sam')
  expect(changed.project.slides[0].svg).toContain('#234567')
  expect(changed.project.video!.scenes[0].moments[0].take).toEqual(scene.moments[0].take)
  expect(changed.project.video!.scenes[0].inputKey).not.toBe(scene.inputKey)
  expect(changed.views!.scenes.scene.produced).toBe(false)
  expect(changed.views!.video.action).toBe('produce-video')
  expect(changed.views!.video.enabled).toBe(false)
  await saveStudioSettings({branding:{name:'Sam',tagline:'Engineering',accent:'#234567',useAccent:false,logoKey:null},projectId:'brand'})
  expect((await loadProject('brand'))!.project.slides[0].svg).toContain('#112233')
})

it('persists the creative harness and model for new notebooks and uses Kimi K3 when no engine preference is saved',async()=>{
 const settings=await saveStudioSettings({harness:{adapter:'kimi',model:'kimi-code/k3'}})
 expect(settings.harness).toEqual({adapter:'kimi',model:'kimi-code/k3'})
 expect((await getStudioSettings()).harness).toEqual(settings.harness)
 await expect(saveStudioSettings({harness:{adapter:'unknown'}})).rejects.toThrow('supported harness')
 expect((await saveStudioSettings({harness:null})).harness).toEqual({adapter:'kimi',model:'kimi-code/k3'})
})
