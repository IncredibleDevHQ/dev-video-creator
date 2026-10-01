import {expect,it} from 'vitest'
import {compactTokens} from '../app/token-usage'
it('abbreviates usage without unnecessary decimals',()=>{
 expect(compactTokens(164)).toBe('164')
 expect(compactTokens(200000)).toBe('200K')
 expect(compactTokens(3200000)).toBe('3.2M')
 expect(compactTokens(4528999)).toBe('4.5M')
 expect(compactTokens(1000000)).toBe('1M')
})
