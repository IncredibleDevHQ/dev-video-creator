import puppeteer from 'puppeteer'
import type {Project,Scene} from '../shared/model'
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
/** Product-owned overlays stay above full-screen camera footage. No network assets. */
export async function presenterOverlays(project:Project,scene:Scene){
 const moments=scene.moments.filter(m=>m.layout==='full-screen' && m.camera!=='none' && m.overlay)
 const images:Record<string,Buffer>={}
 if(!moments.length)return images
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox'],handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false})
 try{
  const page=await browser.newPage();await page.setViewport({width:1920,height:1080,deviceScaleFactor:1})
  for(const moment of moments){
   const title=moment.overlay==='title-card'?project.title:moment.overlay==='end-card'?'Thanks for watching':''
   const name=project.branding?.name || ''
   await page.setContent(`<html><style>html,body{margin:0;width:1920px;height:1080px;background:transparent;color:white;font-family:Arial,sans-serif}h1{position:absolute;left:90px;right:90px;top:65px;margin:0;font-size:86px;line-height:1.12;text-shadow:0 2px 14px #0009;overflow-wrap:anywhere}.name{position:absolute;left:90px;bottom:90px;padding:20px 28px;background:#101817e8;border-left:6px solid #4fbb78;border-radius:8px;font-size:42px;max-width:1500px}.name small{display:block;font-size:26px;margin-top:8px}</style>${title?`<h1>${escape(title)}</h1>`:''}${name && moment.overlay!=='end-card'?`<div class="name">${escape(name)}${project.branding?.tagline?`<small>${escape(project.branding.tagline)}</small>`:''}</div>`:''}</html>`)
   images[moment.id]=Buffer.from(await page.screenshot({type:'png',omitBackground:true}))
  }
 }finally{await browser.close()}
 return images
}
