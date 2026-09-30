import {createHash} from 'node:crypto'
import type {Project} from '../shared/model'
import {readAsset,readRow,storeAsset,writeRow} from './persistence'
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
// SVG images are inert documents: embedded scripts cannot execute and their
// styles/IDs cannot collide with another slide. Network is also blocked below.
export const presentationHtml=(project:Pick<Project,'title'|'slides'>)=>`<!doctype html><html><head><meta charset="utf-8"><title>${escape(project.title)}</title><style>
@page{size:1280px 720px;margin:0}html,body{margin:0;padding:0;background:white}.slide{position:relative;width:1280px;height:720px;overflow:hidden;break-after:page}.slide:last-child{break-after:auto}img{width:100%;height:100%;object-fit:contain;display:block}.draft{padding:80px;font:48px sans-serif}.draft small{display:block;font-size:24px;margin-bottom:40px;color:#92400e}
</style></head><body>${project.slides.map(slide=>`<section class="slide">${slide.svg?`<img alt="${escape(slide.title)}" src="data:image/svg+xml;base64,${Buffer.from(slide.svg).toString('base64')}">`:`<div class="draft"><small>Draft · not designed</small>${escape(slide.title || 'Blank slide')}</div>`}</section>`).join('')}</body></html>`
export const renderPresentationPdf=async(project:Pick<Project,'title'|'slides'>)=>{
 if(!project.slides.length) throw new Error('Add slides before exporting')
 const {default:puppeteer}=await import('puppeteer')
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox'],handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false})
 try{
  const page=await browser.newPage()
  await page.setJavaScriptEnabled(false)
  await page.setRequestInterception(true)
  page.on('request',request=>{void (request.url().startsWith('data:') || request.url()==='about:blank'?request.continue():request.abort())})
  await page.setContent(presentationHtml(project),{waitUntil:'load',timeout:60000})
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()))})
  return Buffer.from(await page.pdf({width:'1280px',height:'720px',printBackground:true,preferCSSPageSize:true}))
 }finally{await browser.close()}
}
type ExportRecord={projectId:string;inputKey:string;objectKey:string}
const pending=new Map<string,Promise<Buffer>>()
export const exportPresentation=async(project:Project)=>{
 const inputKey=createHash('sha256').update(JSON.stringify({version:1,title:project.title,slides:project.slides.map(({id,title,svg})=>({id,title,svg}))})).digest('hex')
 const key=`${project.id}-${inputKey}`
 const cached=await readRow<ExportRecord>('presentation-exports',key)
 if(cached?.projectId===project.id && cached.inputKey===inputKey) return readAsset(cached.objectKey)
 const existing=pending.get(key);if(existing) return existing
 const work=(async()=>{
  const pdf=await renderPresentationPdf(project)
  const asset=await storeAsset({projectId:project.id,body:pdf,contentType:'application/pdf',extension:'.pdf',kind:'presentation-export'})
  await writeRow('presentation-exports',key,{projectId:project.id,inputKey,objectKey:asset.objectKey})
  return pdf
 })()
 pending.set(key,work)
 try{return await work}finally{pending.delete(key)}
}
