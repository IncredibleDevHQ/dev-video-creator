// Real HTTP + PostgreSQL compare-and-swap/rollback test against an isolated worker.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
const origin=process.env.STUDIO_TEST_ORIGIN
if(!origin || !process.env.STUDIO_DATABASE_URL) throw Error('Set STUDIO_TEST_ORIGIN and an isolated STUDIO_DATABASE_URL')
const db=new pg.Client({connectionString:process.env.STUDIO_DATABASE_URL}); await db.connect()
const id=`atomic-${randomUUID()}`, asset=randomUUID(),take=randomUUID()
const request=(body)=>fetch(`${origin}/api/projects/${id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
const read=()=>fetch(`${origin}/api/projects/${id}`).then(r=>r.json()).then(b=>b.project)
const original={version:1,id,title:'Original',notebook:{type:'doc',content:[{type:'scene',attrs:{id:'scene',script:'Original line'}}]},blocks:{},presenterTracks:{},recordedBlocks:{scene:{blockId:'scene',recordingId:take,videoUrl:'/fixture.webm',durationMs:4000}}}
try {
 assert.equal((await request(original)).status,200)
 await db.query('insert into studio_assets (id,notebook_id,object_key,content_type,byte_size,kind) values ($1,$2,$3,$4,0,$5)',[asset,id,`${id}/fixture.webm`,'video/webm','recording'])
 await db.query('insert into studio_presenter_takes (id,notebook_id,block_id,asset_id,duration_ms) values ($1,$2,$3,$4,4000)',[take,id,'scene',asset])
 await db.query('insert into studio_take_selections (notebook_id,block_id,take_id) values ($1,$2,$3)',[id,'scene',take])
 await db.query('insert into studio_recorded_blocks (id,notebook_id,block_id,asset_id,duration_ms) values ($1,$2,$3,$4,4000)',[take,id,'scene',asset])
 const candidate={...structuredClone(original),title:'Finished',recordedBlocks:{}}
 const edit={...structuredClone(original),title:'Newer user edit'}
 assert.equal((await request({project:edit,expectedProject:await read()})).status,200)
 assert.equal((await request({project:candidate,expectedProject:original,clearTakeBlocks:['scene']})).status,409)
 assert.equal((await read()).title,edit.title)
 assert.equal((await db.query('select * from studio_take_selections where notebook_id=$1',[id])).rowCount,1)
 console.log('PASS write-time conflict preserves both newer edit and selection')
 // Cause a failure after selection DELETEs but before COMMIT, through an invalid block.
 const invalid={...structuredClone(candidate),notebook:{type:'doc',content:[null]}}
 assert.equal((await request({project:invalid,expectedProject:edit,clearTakeBlocks:['scene']})).ok,false)
 assert.equal((await read()).title,edit.title)
 assert.equal((await db.query('select * from studio_take_selections where notebook_id=$1',[id])).rowCount,1)
 assert.equal((await db.query('select * from studio_recorded_blocks where notebook_id=$1',[id])).rowCount,1)
 console.log('PASS failed transaction rolls back artifact and both selection records')
 assert.equal((await request({project:candidate,expectedProject:edit,clearTakeBlocks:['scene']})).status,200)
 assert.equal((await read()).title,candidate.title)
 assert.equal((await db.query('select * from studio_take_selections where notebook_id=$1',[id])).rowCount,0)
 assert.equal((await db.query('select * from studio_recorded_blocks where notebook_id=$1',[id])).rowCount,0)
 console.log('ATOMIC PROJECT CHECK PASS')
} finally {await fetch(`${origin}/api/projects/${id}`,{method:'DELETE'});await db.end()}
