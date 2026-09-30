import {afterEach,expect,it,vi} from 'vitest'
import {requestJson} from '../app/http'
afterEach(()=>vi.unstubAllGlobals())
it('gives a useful offline message and does not retry a possibly completed write',async()=>{
 const fetcher=vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));vi.stubGlobal('fetch',fetcher)
 await expect(requestJson('/api/projects',{method:'POST'})).rejects.toThrow('Check that it is running')
 expect(fetcher).toHaveBeenCalledTimes(1)
})
it('handles proxy HTML errors without showing raw response content',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>internal proxy detail</html>',{status:502})))
 await expect(requestJson('/api/projects')).rejects.toThrow('Try again when it is ready')
})
it('retains application validation feedback and rejects malformed success responses',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({error:'Choose a moment in this scene'},{status:400})).mockResolvedValueOnce(new Response(''))
 vi.stubGlobal('fetch',fetcher)
 await expect(requestJson('/api/projects')).rejects.toThrow('Choose a moment in this scene')
 await expect(requestJson('/api/projects')).rejects.toThrow('incomplete response')
})
