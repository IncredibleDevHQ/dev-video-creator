import type {Snapshot} from '../shared/api'
import {escape,button} from './ui'
export type NotebookOpeningState={id:string,phase:'loading'|'failed',message?:string}
/** A late response must not reopen a notebook after the user leaves it. */
export class NotebookOpening {
 state:NotebookOpeningState|null=null
 private request=0
 constructor(private load:(id:string)=>Promise<Snapshot>,private ready:(snapshot:Snapshot)=>void,private changed:()=>void){}
 reset(){this.request++;this.state=null}
 async open(id:string){
  if(this.state?.id===id && this.state.phase==='loading')return
  const request=++this.request
  this.state={id,phase:'loading'};this.changed()
  try{
   const snapshot=await this.load(id)
   if(request!==this.request)return
   this.state=null;this.ready(snapshot)
  }catch(reason){
   if(request!==this.request)return
   this.state={id,phase:'failed',message:reason instanceof Error?reason.message:'Could not open this notebook. Try again.'};this.changed()
  }
 }
}
export const notebookOpeningView=(state:NotebookOpeningState)=>`<main class="notebook-opening"><section role="status" aria-live="polite">${state.phase==='loading'?'<span class="spinner" aria-hidden="true"></span><h1>Opening your notebook</h1><p>Loading your saved slides, scenes and activity.</p>':`<h1>Could not open this notebook</h1><p>${escape(state.message || 'Try again when Studio is available.')}</p>${button('Try again','open-notebook',true)}<p class="opening-note">Your notebook link is kept. Retrying only loads saved work.</p>`}</section></main>`
