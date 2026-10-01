import type {Project} from '../shared/model'

/** Stable IDs keep a recording's scene/moment selected after reopening its URL. */
export function workspacePosition(project:Project,url:URL){
 const scenes=project.video?.scenes || []
 const found=scenes.findIndex(scene=>scene.id===url.searchParams.get('scene'))
 const selected=Math.max(0,found),moments=scenes[selected]?.moments || []
 const matched=moments.findIndex(moment=>moment.id===url.searchParams.get('moment'))
 const momentIndex=Math.max(0,matched)
 return {selected,momentIndex,second:moments[momentIndex]?.start || 0}
}
export function workspaceUrl(url:URL,project:Project,stage:string,selected:number,momentIndex:number){
 const next=new URL(url.href)
 next.searchParams.set('view',stage)
 if(stage==='video'){
  const scene=project.video?.scenes[selected],moment=scene?.moments[momentIndex]
  if(scene)next.searchParams.set('scene',scene.id);else next.searchParams.delete('scene')
  if(moment)next.searchParams.set('moment',moment.id);else next.searchParams.delete('moment')
 }
 return next
}
