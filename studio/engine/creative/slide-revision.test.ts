import {expect,it} from 'vitest'
import {validateSlideRevision} from './slide-revision'
import {readSourceNarrative} from '../source'
const source=readSourceNarrative('Canvas provides a workspace for writing and coding.')
const scene={title:'Canvas',kind:'list',seconds:6,narration:'Work together in canvas.',source:[source.text],parts:[],relations:[]}
it('keeps single-slide revisions grounded in the retained source',()=>{
 expect(validateSlideRevision({scenes:[scene]},source).ok).toBe(true)
 expect(validateSlideRevision({scenes:[{...scene,source:['An unsupported claim.']}]},source).problems).toContain('Every source passage must come from the retained article')
 expect(validateSlideRevision({scenes:[scene,scene]},source).problems).toContain('Revise exactly one slide')
})
