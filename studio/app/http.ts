// One response boundary for JSON requests and media uploads. Never retry a
// mutation automatically: a lost response does not mean the write failed.
export const requestJson=async<T>(url:string,options?:RequestInit):Promise<T>=>{
 let response:Response
 try{response=await fetch(url,options)}catch{throw new Error('Studio is unavailable. Check that it is running, then try again.')}
 const result:unknown=await response.json().catch(()=>null)
 if(!response.ok){
  const message=result && typeof result==='object' && 'error' in result?result.error:null
  throw new Error(typeof message==='string' && message.trim()?message:response.status>=500?'Studio could not complete this request. Try again when it is ready.':'This request could not be completed. Check your input and try again.')
 }
 if(result===null) throw new Error('Studio returned an incomplete response. Try again.')
 return result as T
}
