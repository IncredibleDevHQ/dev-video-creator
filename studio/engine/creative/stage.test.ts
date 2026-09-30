import {beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({run:vi.fn(),load:vi.fn(),save:vi.fn()}))
vi.mock('../harness/runtime',()=>({runEngineStage:mocks.run}))
vi.mock('../artifacts',()=>({loadStageCheckpoint:mocks.load,saveStageCheckpoint:mocks.save,archiveFiles:vi.fn()}))
import {runValidatedJsonStage} from './stage'
const input={projectId:'notebook',sceneId:'scene',inputKey:'revision',checkpoint:'treatment',route:'Plan Scene',file:'planning/treatment.json',tool:'plan_submit_treatment',packet:{},selection:{adapter:'kimi' as const,model:'kimi-code/k3'},origin:'http://localhost:4320',validate:()=>({ok:true,problems:[],warnings:[],value:{accepted:true}})}
beforeEach(()=>vi.clearAllMocks())
it('returns the persisted artifact without launching another harness',async()=>{
 mocks.load.mockResolvedValue({data:{accepted:true}})
 expect(await runValidatedJsonStage(input)).toEqual({accepted:true})
 expect(mocks.run).not.toHaveBeenCalled()
})
it('shares concurrent work for the same notebook stage and input revision',async()=>{
 let release:()=>void=()=>{}
 mocks.load.mockResolvedValueOnce(null).mockResolvedValue({data:{accepted:true}})
 mocks.run.mockImplementation(async()=>{await new Promise<void>(resolve=>{release=resolve});return{status:'done'}})
 const first=runValidatedJsonStage(input),second=runValidatedJsonStage(input)
 expect(first).toBe(second)
 await vi.waitFor(()=>expect(mocks.run).toHaveBeenCalledOnce())
 release()
 expect(await first).toEqual({accepted:true})
 expect(await second).toEqual({accepted:true})
})
it('allows a failed stage to retry rather than retaining its rejected promise',async()=>{
 mocks.load.mockResolvedValue(null)
 mocks.run.mockResolvedValue({status:'error',failure:{message:'Synthetic failure'}})
 await expect(runValidatedJsonStage(input)).rejects.toThrow('Synthetic failure')
 await expect(runValidatedJsonStage(input)).rejects.toThrow('Synthetic failure')
 expect(mocks.run).toHaveBeenCalledTimes(2)
})
