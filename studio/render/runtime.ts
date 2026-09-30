import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
export const RUNTIME_PATHS: Record<string,string> = {
  '/runtime/gsap.min.js': join(dirname(require.resolve('gsap')),'gsap.min.js'),
  '/runtime/hyperframes.iife.js': join(dirname(require.resolve('@hyperframes/core/package.json')),'dist','hyperframe.runtime.iife.js'),
}
