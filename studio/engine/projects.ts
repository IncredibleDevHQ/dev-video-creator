import {sumUsage} from '../shared/usage'
import {cancelEngineRun,type EngineRun} from './harness/runtime'
import {generationStops,generationFailure} from './generation-errors'
import {prepareCreativeBrief} from './creative/brief'
import {loadHarnessPreference,validateHarnessSelection} from './harness/preference'
import {prepareCreativeStory} from './creative/story'
import {prepareCreativePages} from './creative/pages'
import {prepareCreativeSlideRevision} from './creative/slide-revision'
import {fingerprintOf} from './planning/fingerprint'
import type {HarnessSelection} from '../shared/model'
import { randomUUID } from 'node:crypto'
import type { Snapshot, SlideEdit, ChatRequest } from '../shared/api'
import type { ProjectEvent } from '../shared/model'
import { readRow, writeRow,storeAsset,listRows,listNotebookRows } from './persistence'
import { reconcileVideo, refreshVideoKeys } from './scene-model'
import { projectViews } from './state'
import { modelFetch } from './model-gateway'
import { SourceReadError, readSourceNarrative, readSourceUrl, outlineSchema, outlinePrompt, sanitizeOutline, pageBrandFrom, renderPage } from './source'
const subscribers = new Map<string, Set<(snapshot: Snapshot) => void>>()
const queues = new Map<string, Promise<unknown>>()
export const loadProject = async (id: string) => {
  const snapshot = await readRow<Snapshot>('projects', id)
  if (snapshot) {
    snapshot.views = projectViews(snapshot.project)
    const runs=await Promise.all((await listNotebookRows('engine-runs',id)).map(runId=>readRow<EngineRun>('engine-runs',runId)))
    snapshot.tokenUsage=sumUsage(runs.filter((run):run is EngineRun=>Boolean(run)))
  }
  return snapshot
}
export const subscribe = (id: string, callback: (snapshot: Snapshot) => void) => {
  const listeners = subscribers.get(id) || new Set(); listeners.add(callback); subscribers.set(id, listeners)
  return () => { listeners.delete(callback); if (!listeners.size) subscribers.delete(id) }
}
export const changeProject = async (id: string, update: (snapshot: Snapshot) => void | Promise<void>) => {
  const previous = queues.get(id) || Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    const snapshot = await loadProject(id)
    if (!snapshot) throw new Error('Project not found')
    await update(snapshot)
    snapshot.views = projectViews(snapshot.project)
    await writeRow('projects', id, snapshot)
    subscribers.get(id)?.forEach(listener => listener(snapshot))
    return snapshot
  })
  queues.set(id, next)
  try { return await next } finally { if (queues.get(id) === next) queues.delete(id) }
}
export const addEvent = (snapshot: Snapshot, kind: ProjectEvent['kind'], message: string, extras: Partial<ProjectEvent> = {}) => {
  snapshot.events.push({ ...extras, sequence: (snapshot.events.at(-1)?.sequence || 0) + 1, projectId: snapshot.project.id, time: new Date().toISOString(), kind, message })
}
export const createProject = async (input: string, harness?:HarnessSelection): Promise<Snapshot> => {
  if (!input.trim()) throw new Error('Add a link or some text')
  harness=harness?validateHarnessSelection(harness):await loadHarnessPreference() || undefined
  const id = randomUUID()
  const branding = await readRow<import('../shared/settings').Branding>('settings','branding') || undefined
  const snapshot: Snapshot = { project: { id, branding, harness, title: 'Untitled video', source: input.trim(), slides: [], video: null }, status: 'building', error: null, events: [] }
  addEvent(snapshot, 'slide', 'Reading your source')
  await writeRow('projects', id, snapshot)
  scheduleSlides(id)
  return snapshot
}
const building = new Map<string,Promise<void>>()
export const scheduleSlides = (id: string) => {
  if (building.has(id)) return
  const work = buildSlides(id).catch(async (reason) => {
    await changeProject(id, current => { current.status = 'failed'; current.error = current.stopping?generationStops.user:reason instanceof SourceReadError?reason.message:generationFailure(reason,'Could not make the slides. Check your AI settings and try again.');if(reason instanceof SourceReadError) current.sourceFailure='blocked'; addEvent(current, 'slide', current.error) })
  }).finally(() => building.delete(id))
  building.set(id,work); void work.catch(() => {})
}
export const stopSlides = async (id:string) => {
  await changeProject(id,current=>{
    if(current.status!=='building') throw new Error('This presentation is not being generated')
    current.stopping=true;addEvent(current,'slide','Stopping generation. Keeping your saved slides.')
  })
  for(const runId of await listNotebookRows('engine-runs',id)){
    const run=await readRow<EngineRun>('engine-runs',runId)
    if(run && !run.sceneId && ['preparing','running'].includes(run.status)) cancelEngineRun(run.id)
  }
  if(!building.has(id)) await changeProject(id,current=>{current.status='failed';current.error=generationStops.user})
  return (await loadProject(id))!
}
export const retrySlides = async (id: string) => {
  const snapshot = await changeProject(id,current => {
    if(building.has(id)) throw new Error('Wait for generation to stop before continuing')
    if (current.status !== 'failed') throw new Error('Your slides do not need a retry')
    current.stopping=false;current.status = 'building'; current.error = null; addEvent(current,'slide','Trying your slides again')
  })
  scheduleSlides(id); return snapshot
}
export const replaceBlockedSource=async(id:string,text:unknown)=>{
  if(typeof text!=='string' || text.trim().length<40 || text.length>500000) throw new Error('Paste the article text, rather than only its link')
  const snapshot=await changeProject(id,async current=>{
    if(current.status!=='failed' || !current.sourceFailure || current.project.slides.length || current.project.video) throw new Error('This notebook does not need replacement source text')
    const sourceUrl=current.project.sourceUrl || current.project.source
    const url=new URL(sourceUrl)
    if(!['https:','http:'].includes(url.protocol)) throw new Error('The original source link is invalid')
    const source={...readSourceNarrative(text.trim()),url:sourceUrl,site:url.hostname}
    source.warnings.push('Article text supplied by the creator after automatic reading was blocked.')
    await writeRow('sources',id,source)
    current.project.sourceUrl=sourceUrl;current.project.source=text.trim();current.status='building';current.error=null;delete current.sourceFailure
    addEvent(current,'slide','Using your pasted article text')
  })
  scheduleSlides(id);return snapshot
}
type SlideCheckpoint = {
  source: ReturnType<typeof readSourceNarrative>
  outline: ReturnType<typeof sanitizeOutline>
  brand: ReturnType<typeof pageBrandFrom>
  slideIds?: string[]
}
const requireSlidesRunning=async(id:string)=>{if((await loadProject(id))?.stopping) throw new Error(generationStops.user)}
const buildSlides = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot || snapshot.status !== 'building') return
  if(!snapshot.project.harness){snapshot.project.harness=(await loadHarnessPreference())!;await changeProject(id,current=>{current.project.harness=snapshot.project.harness})}
  let checkpoint = await readRow<SlideCheckpoint>('outlines',id)
  if (!checkpoint) {
    let source = await readRow<ReturnType<typeof readSourceNarrative>>('sources',id)
    if (!source) {
      const input = snapshot.project.source
      source = /^https?:\/\//i.test(input) ? await readSourceUrl(input, { projectId: id }) : readSourceNarrative(input)
      await writeRow('sources',id,source)
    }
    await requireSlidesRunning(id)
    await changeProject(id, current => { current.project.title = source!.title || 'Untitled video';current.project.source=source!.text;if(source!.url) current.project.sourceUrl=source!.url; addEvent(current, 'slide', 'Source ready') })
    let outline:ReturnType<typeof sanitizeOutline>
    {
      const origin=process.env.MINIMAL_STUDIO_HARNESS_ORIGIN || `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
      await changeProject(id,current=>addEvent(current,'slide','Understanding the source'))
      const brief=await prepareCreativeBrief({...snapshot.project,source:source.text},snapshot.project.harness,origin,undefined,'source')
      await requireSlidesRunning(id)
      await changeProject(id,current=>addEvent(current,'slide','Planning the story'))
      outline=await prepareCreativeStory(id,source,snapshot.project.harness,origin,brief)
    }
    if (!outline.scenes.length) throw new Error('No slides generated')
    checkpoint = {source,outline,brand:pageBrandFrom(source.palette,source.fonts),slideIds:outline.scenes.map(() => randomUUID())}
    // Commit identities before any slide, so an interrupted build resumes the same outline.
    await writeRow('outlines',id,checkpoint)
  }
  if (!checkpoint.slideIds) {
    checkpoint.slideIds = checkpoint.outline.scenes.map((_scene,index) => snapshot.project.slides[index]?.id || randomUUID())
    await writeRow('outlines',id,checkpoint)
  }
  const {source,outline,brand,slideIds} = checkpoint
  const currentBrand=(await loadProject(id))!.project.branding
  const designBrand=currentBrand?.useAccent?{...brand,accent:currentBrand.accent}:brand
  const sourceBrief=await readRow<{brief:import('./creative/explanation-brief').ExplanationBriefV1}>('source-briefs',id)
  await changeProject(id,current=>{current.plannedSlides=outline.scenes.length;addEvent(current,'slide',`Designing your ${outline.scenes.length} slides`)})
  const onDraft=async(index:number,svg:string)=>changeProject(id,async current=>{
    const slideId=slideIds[index],scene=outline.scenes[index]
    if(current.project.slides.some(slide=>slide.id===slideId && !slide.draft)) return
    const asset=await storeAsset({body:Buffer.from(svg),contentType:'image/svg+xml',extension:'.svg',kind:'slide-draft',projectId:id})
    await writeRow('slide-drafts',slideId,{projectId:id,slideId,index,artifactId:asset.id,objectKey:asset.objectKey})
    const draft={draft:true,id:slideId,title:scene.title,svg,narration:scene.narration,idea:scene.idea,evidence:scene.source}
    const existing=current.project.slides.findIndex(slide=>slide.id===slideId)
    if(existing>=0) current.project.slides[existing]=draft
    else current.project.slides.push(draft)
    current.project.slides.sort((a,b)=>slideIds.indexOf(a.id)-slideIds.indexOf(b.id))
    addEvent(current,'slide',`Draft ${index+1} of ${outline.scenes.length} is available`)
  }).then(()=>{})
  await requireSlidesRunning(id)
  const designed=await prepareCreativePages({projectId:id,source,outline,onDraft,brief:sourceBrief?.brief,brand:designBrand,selection:snapshot.project.harness,origin:process.env.MINIMAL_STUDIO_HARNESS_ORIGIN || `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`})
  for (const [index, scene] of outline.scenes.entries()) {
    const slideId = slideIds[index]
    await changeProject(id, async current => {
      if(current.project.slides.some(slide=>slide.id===slideId && !slide.draft)) return
      const pageBrand=current.project.branding?.useAccent?{...brand,accent:current.project.branding.accent}:brand
      const svg=designed[index]
      if(!svg) throw new Error('The creative drawing stage did not return this page')
      const asset=await storeAsset({body:Buffer.from(svg),contentType:'image/svg+xml',extension:'.svg',kind:'slide-artwork',projectId:id})
      await writeRow('slide-artifacts',slideId,{projectId:id,slideId,artifactId:asset.id,objectKey:asset.objectKey})
      current.project.title = outline.title
      const accepted={ id: slideId, title: scene.title, svg, narration: scene.narration, idea: scene.idea, evidence: scene.source }
      const existing=current.project.slides.findIndex(slide=>slide.id===slideId)
      if(existing>=0) current.project.slides[existing]=accepted
      else current.project.slides.push(accepted)
      addEvent(current, 'slide', `Slide ${index + 1} of ${outline.scenes.length}`, { anchor: { stage: 'presentation', slideId } })
    })
  }
  await changeProject(id, current => { if(current.stopping) throw new Error(generationStops.user);current.status = 'ready'; current.error = null; addEvent(current, 'slide', 'Your slides are ready') })
}
export const editSlide = (id: string, edit: SlideEdit) => changeProject(id, snapshot => {
  if (snapshot.status === 'building') throw new Error('Wait for the slides to finish')
  const slides = snapshot.project.slides
  const index = slides.findIndex(slide => slide.id === edit.slideId)
  const restored = snapshot.deletedSlide
  if (edit.action === 'undo-delete') {
    if (!snapshot.deletedSlide) throw new Error('No slide to restore')
    slides.splice(Math.min(snapshot.deletedSlide.index, slides.length), 0, snapshot.deletedSlide.slide)
    if (snapshot.deletedSlide.scene && snapshot.project.video) snapshot.project.video.scenes.push(snapshot.deletedSlide.scene)
    delete snapshot.deletedSlide
  } else if (edit.action === 'add') slides.push({ id: randomUUID(), title: '', svg: null })
  else {
    if (index < 0) throw new Error('Slide not found')
    if (edit.action === 'delete') {
      const video = snapshot.project.video
      snapshot.deletedSlide = { index, slide: slides.splice(index, 1)[0], scene: video?.scenes.find(scene => scene.slideId === edit.slideId), seams: video?.scenes.slice(0,-1).flatMap((scene,i) => scene.slideId === edit.slideId || video.scenes[i+1].slideId === edit.slideId ? [{left:scene.slideId,right:video.scenes[i+1].slideId,transition:video.transitions[i]}] : []) }
    }
    if (edit.action === 'duplicate') slides.splice(index + 1, 0, { ...slides[index], id: randomUUID() })
    if (edit.action === 'move') {
      if (!Number.isInteger(edit.index) || edit.index! < 0 || edit.index! >= slides.length) throw new Error('Invalid position')
      slides.splice(edit.index!, 0, slides.splice(index, 1)[0])
    }
  }
  reconcileVideo(snapshot.project)
  if (edit.action === 'undo-delete' && restored?.seams && snapshot.project.video) {
    const video = snapshot.project.video
    video.scenes.slice(0,-1).forEach((scene,index) => {
      const seam = restored!.seams!.find(seam => seam.left === scene.slideId && seam.right === video.scenes[index+1].slideId)
      if (seam) video.transitions[index] = seam.transition
    })
    refreshVideoKeys(snapshot.project)
  }
  addEvent(snapshot, 'slide', 'Slides updated')
})

export const chatSlide = async (id: string, request: ChatRequest) => {
  if (request?.anchor?.stage !== 'presentation') throw new Error('Select a slide first')
  if(typeof request.instruction!=='string' || !request.instruction.trim() || request.instruction.length>4000) throw new Error('Add an instruction of up to 4000 characters')
  const snapshot=await loadProject(id)
  if(!snapshot) throw new Error('Notebook not found')
  const slideId = request.anchor.slideId
  const index = snapshot.project.slides.findIndex(slide => slide.id === slideId)
  if(index<0) throw new Error('Select a slide first')
  if(snapshot.status!=='ready') throw new Error('Wait for your slides')
  const retained=await readRow<{source:ReturnType<typeof readSourceNarrative>;brand:ReturnType<typeof pageBrandFrom>}>('outlines',id)
  if(!retained) throw new Error('Source not found')
  const revisionKey=(project:Snapshot['project'])=>fingerprintOf({slide:project.slides.find(slide=>slide.id===slideId),order:project.slides.map(slide=>slide.id),branding:project.branding})
  const expected=revisionKey(snapshot.project)
  await changeProject(id,current=>addEvent(current,'chat',request.instruction,{anchor:request.anchor}))
  try{
    let revised:import('./source').OutlineScene
    const origin=process.env.MINIMAL_STUDIO_HARNESS_ORIGIN || `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
    if(snapshot.project.harness){
      const outline=await prepareCreativeSlideRevision({projectId:id,slide:snapshot.project.slides[index],index,instruction:request.instruction,source:retained.source,selection:snapshot.project.harness,origin})
      revised=outline.scenes[0]
    }else{
      const response=await modelFetch('writing',{body:JSON.stringify({input:`Revise one slide of this presentation. Return a complete outline containing exactly ONE scene. Use the provided source as evidence. Current slide title: ${snapshot.project.slides[index].title}. Creator instruction: ${request.instruction}. Source: ${retained.source.text}`,text:{format:{type:'json_schema',name:'slide_revision',strict:true,schema:outlineSchema()}}})})
      if(!response.ok) throw new Error('Could not revise the slide')
      const result=await response.json()
      const text=result.output?.flatMap(item=>item.content || []).filter(item=>item.type==='output_text').map(item=>item.text || '').join('') || ''
      const candidate=await storeAsset({body:Buffer.from(text),contentType:'application/json',extension:'.json',projectId:id,sceneId:`scene-${slideId}`,kind:'slide-revision-candidate'})
      await writeRow('slide-revision-attempts',candidate.id,{projectId:id,slideId,artifactId:candidate.id,objectKey:candidate.objectKey,instruction:request.instruction})
      revised=sanitizeOutline(JSON.parse(text),snapshot.project.title,retained.source.text).scenes[0]
    }
    if(!revised) throw new Error('No revised slide')
    const pageBrand=snapshot.project.branding?.useAccent?{...retained.brand,accent:snapshot.project.branding.accent}:retained.brand
    const svg=snapshot.project.harness?(await prepareCreativePages({projectId:id,source:retained.source,outline:{title:snapshot.project.title,scenes:[revised],targetSeconds:revised.seconds,glossary:[]},brand:pageBrand,selection:snapshot.project.harness,origin,pageOffset:index,reuseStyle:true}))[0]:renderPage(revised,index,snapshot.project.slides.length,pageBrand,{title:snapshot.project.title,site:retained.source.site})
    return await changeProject(id,async current=>{
      if(current.status!=='ready' || revisionKey(current.project)!==expected) throw new Error('This slide changed while it was being revised. Send the instruction again.')
      const currentIndex=current.project.slides.findIndex(slide=>slide.id===slideId)
      const asset=await storeAsset({body:Buffer.from(svg),contentType:'image/svg+xml',extension:'.svg',projectId:id,sceneId:`scene-${slideId}`,kind:'slide-artwork'})
      await writeRow('slide-artifacts',slideId,{projectId:id,slideId,artifactId:asset.id,objectKey:asset.objectKey})
      current.project.slides[currentIndex]={id:slideId,title:revised.title,svg,narration:revised.narration,idea:revised.idea,evidence:revised.source}
      reconcileVideo(current.project)
      addEvent(current,'chat','Updated this slide.',{anchor:request.anchor})
    })
  }catch(error){
    await changeProject(id,current=>addEvent(current,'chat','Could not update this slide. Try again.',{anchor:request.anchor}))
    throw error
  }
}

export const listNotebooks = async ():Promise<import('../shared/api').NotebookSummary[]> => {
  const result=[]
  for(const id of await listRows('projects')) {
    const saved=await loadProject(id)
    if(saved) result.push({id,title:saved.project.title,status:saved.status,hasVideo:Boolean(saved.project.video),updatedAt:saved.events.at(-1)?.time || null})
  }
  return result.sort((a,b)=>(b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0,50)
}
