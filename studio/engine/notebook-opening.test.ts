import {expect,it,vi} from 'vitest'
import {NotebookOpening,notebookOpeningView} from '../app/notebook-opening'
import type {Snapshot} from '../shared/api'
const snapshot={project:{id:'saved'}} as Snapshot
it('keeps the notebook identity after connection failure and retries only the read',async()=>{
 const load=vi.fn().mockRejectedValueOnce(new Error('Studio is unavailable.')).mockResolvedValueOnce(snapshot)
 const ready=vi.fn(),changed=vi.fn(),opening=new NotebookOpening(load,ready,changed)
 await opening.open('saved')
 expect(opening.state).toEqual({id:'saved',phase:'failed',message:'Studio is unavailable.'})
 expect(ready).not.toHaveBeenCalled()
 await opening.open(opening.state!.id)
 expect(load.mock.calls).toEqual([['saved'],['saved']]);expect(ready).toHaveBeenCalledWith(snapshot)
 expect(opening.state).toBeNull()
})
it('ignores a late notebook response after leaving or selecting another notebook',async()=>{
 let resolve!:(value:Snapshot)=>void
 const ready=vi.fn(),opening=new NotebookOpening(()=>new Promise(done=>{resolve=done}),ready,()=>{})
 const pending=opening.open('saved');opening.reset();resolve(snapshot);await pending
 expect(ready).not.toHaveBeenCalled();expect(opening.state).toBeNull()
})
it('deduplicates repeated opening clicks while a read is pending',async()=>{
 let resolve!:(value:Snapshot)=>void
 const load=vi.fn(()=>new Promise<Snapshot>(done=>{resolve=done})),ready=vi.fn(),opening=new NotebookOpening(load,ready,()=>{})
 const first=opening.open('saved');await opening.open('saved');expect(load).toHaveBeenCalledOnce()
 resolve(snapshot);await first;expect(ready).toHaveBeenCalledOnce()
})
it('shows bounded loading copy and escapes recovery errors',()=>{
 expect(notebookOpeningView({id:'saved',phase:'loading'})).toContain('Opening your notebook')
 const failed=notebookOpeningView({id:'saved',phase:'failed',message:'<script>bad</script>'})
 expect(failed).toContain('&lt;script&gt;');expect(failed).toContain('data-action="open-notebook"')
 expect(failed).not.toContain('spinner')
})
