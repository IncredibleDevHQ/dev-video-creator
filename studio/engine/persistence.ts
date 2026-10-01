import type { AssetInput } from './storage/remote'
import { validObjectKey } from './storage/config'
export {dataRoot} from './storage/config'
export {validObjectKey,assetIdOf} from './storage/config'
const mode=process.env.MINIMAL_STUDIO_PERSISTENCE || (process.env.MINIMAL_STUDIO_DATABASE_URL?'postgres-s3':'local')
if(!['local','postgres-s3'].includes(mode)) throw new Error('Choose local or postgres-s3 persistence')
const backend=mode==='postgres-s3'?await import('./storage/remote'):await import('./storage/local')
export const initializePersistence=backend.initializePersistence
export const readRow=backend.readRow
export const writeRow=backend.writeRow
export const listRows=backend.listRows
export const listNotebookRows=backend.listNotebookRows
export const deleteRow=backend.deleteRow
export const storeAsset=(input:AssetInput)=>backend.storeAsset(input)
export const readAsset=(key:string)=>{if(!validObjectKey(key)) throw new Error('Invalid object key');return backend.readAsset(key)}
export const deleteAsset=(key:string)=>{if(!validObjectKey(key)) throw new Error('Invalid object key');return backend.deleteAsset(key)}
export const closePersistence=backend.closePersistence
export const loadSetting=(key:string)=>readRow<unknown>('settings',key)
export const saveSetting=(key:string,value:unknown)=>writeRow('settings',key,value)

export const withOperationLock=backend.withOperationLock
