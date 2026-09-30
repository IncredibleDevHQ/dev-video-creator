import type {RunFailure} from './harness/types'

export class HarnessStageError extends Error {
 constructor(readonly failure:RunFailure | undefined,fallback:string){super(failure?.message || fallback)}
}

// Product-owned messages only: raw provider/tool errors may contain private data.
export const generationStops={
 user:'Generation stopped. Saved slides are available; continue when you are ready.',
 time:'Stopped at the stage time limit. Saved artifacts are available; retry requires your action.',
 idle:'Stopped after no harness activity. Saved artifacts are available; retry requires your action.',
 tools:'Stopped at the tool-call limit. Saved artifacts are available; retry requires your action.',
} as const
export const generationFailure=(error:unknown,fallback:string)=>{
 const message=error instanceof Error?error.message:''
 const stop=Object.values(generationStops).find(known=>known===message)
 if(stop)return stop
 if(error instanceof HarnessStageError){
  const messages:Record<string,string>={
   storage:'Generation stopped because artifacts could not be saved. Restore storage access before retrying. Recovery from object storage is not confirmed.',
   quota:'Generation stopped because the harness usage limit was reached. Restore credits or choose another harness, then retry. Saved work is retained.',
   auth:'Generation stopped because harness sign-in is required. Sign in, then retry. Saved work is retained.',
   model:'The selected model is unavailable. Choose an available model, then retry. Saved work is retained.',
   'rate-limit':'Generation stopped because the harness is rate limited. Wait before retrying. Saved work is retained.',
   network:'Generation stopped after a connection failure. Check your connection, then retry. Saved work is retained.',
   unavailable:'The selected harness is unavailable. Check its installation or choose another harness. Saved work is retained.',
  }
  return messages[error.failure?.category || ''] || fallback
 }
 return fallback
}
