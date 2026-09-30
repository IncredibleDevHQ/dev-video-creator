import type {Snapshot} from '../shared/api'
import {escape,button} from './ui'
import {presentationProgress} from './progress'
export const presentationScreen=(snapshot:Snapshot,selected:number,pendingChat=false)=>{
 const {project,status}=snapshot
 const slide=project.slides[selected]
 const slides=project.slides
 const latestSlideEvent=[...snapshot.events].reverse().find(event=>event.kind==='slide' || (event.kind==='chat' && event.anchor?.stage==='presentation' && event.anchor.slideId===slide?.id))
 const slideReply=status==='ready'?(latestSlideEvent?.kind==='chat'?latestSlideEvent.message:'Presentation ready'):latestSlideEvent?.message
 const pending=Boolean(status==='building' && !snapshot.stopping && snapshot.plannedSlides && slides.length<snapshot.plannedSlides)
 const validating=status==='building' && !snapshot.stopping && !pending && slides.length>0
 return `<section class="slides">
  <aside class="rail" aria-label="Slides"><div class="rail-heading"><strong>Slides <small>${project.slides.length}</small></strong><button data-action="add" aria-label="New slide" ${status!=='ready'?'disabled':''}>+</button><p>Each slide is one scene of your video.</p></div>${project.slides.map((item,index) => `<button class="thumbnail ${index === selected ? 'selected' : ''}" data-slide="${index}" draggable="true" aria-label="Slide ${index+1}: ${escape(item.title || 'Blank slide')}"><span class="thumb-number">${index+1}</span><div>${item.svg || '<span>Blank slide</span>'}</div></button>`).join('')}${pending?`<div class="thumbnail slide-processing" role="status"><div class="slide-skeleton"></div><span>Designing slide ${project.slides.length+1} of ${snapshot.plannedSlides}</span></div>`:validating?'<p class="deck-validation" role="status"><span class="spinner" aria-hidden="true"></span>Checking your slides</p>':''}</aside>
  <div class="stage-area">
  <div class="stage">${slide?.svg || (slide ? `<div class="blank"><h2>What is this slide about?</h2><p>Tell the studio below.</p></div>` : presentationProgress(snapshot))}</div>
  <div class="slide-caption"><span>${project.slides.length?` ${status!=='ready'?'Draft · ':''}Slide ${selected+1} of ${snapshot.plannedSlides || project.slides.length}`:''}</span>${slide ? `<details class="slide-menu"><summary aria-label="Slide actions">•••</summary><div>${button('Duplicate', 'duplicate', false, status !== 'ready')}${button('Move up', 'up', false, selected === 0 || status !== 'ready')}${button('Move down', 'down', false, selected === project.slides.length-1 || status !== 'ready')}${button('Delete', 'delete', false, status !== 'ready')}</div></details>` : ''}</div>
  <form id="chat" class="chat"><label class="sr" for="instruction">Change this slide</label><input id="instruction" name="instruction" placeholder="Ask for a change, like “split this slide in two”" ${status !== 'ready' ? 'disabled' : ''}><button aria-label="Send instruction" ${status !== 'ready' || pendingChat ? 'disabled' : ''}>↑</button></form>
  <div class="reply"><span>${escape(snapshot.error || (pending?`Designing slide ${slides.length+1} of ${snapshot.plannedSlides} · ${slides.length} ${slides.length===1?'draft':'drafts'} saved`:validating?'Checking your slides':slideReply) || (status==='ready'?'Your slides are in. Check them, then Make the video, top right.':''))}</span>${status==='building'?button(snapshot.stopping?'Stopping…':'Stop generation','stop-slides',false,Boolean(snapshot.stopping || snapshot.readOnly)):''}${snapshot.sourceFailure?button('Paste article text','paste-source',true):''}${status === 'failed' ? button(snapshot.stopping?'Continue generation':'Try again','retry-slides',!snapshot.sourceFailure,Boolean(snapshot.readOnly)) : ''}${snapshot.deletedSlide ? button('Undo delete','undo-delete') : ''}${button('History', 'history')}</div>
  <p id="error" role="alert"></p></div></section>`
}
