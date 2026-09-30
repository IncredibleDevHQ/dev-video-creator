import type {Snapshot} from '../shared/api'
import {listNotebookRows,readRow} from './persistence'
import type {EngineRun} from './harness/runtime'
// Derived display data, never written back into the notebook's event history.
export const withProgress=async(snapshot:Snapshot|null)=>{
 if(!snapshot || snapshot.status!=='building') return snapshot
 const runs=await Promise.all((await listNotebookRows('engine-runs',snapshot.project.id)).map(id=>readRow<EngineRun>('engine-runs',id)))
 const run=runs.filter((run):run is EngineRun=>!!run && !run.sceneId && ['running','preparing'].includes(run.status)).sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0]
 if(!run) return snapshot
 const label=run.stage==='drawing'?'Designing your slides':run.stage==='story'?'Planning the story':'Understanding the source'
 return {...snapshot,progress:{label,startedAt:run.startedAt}}
}
