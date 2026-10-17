import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
const gsapDist = dirname(require.resolve('gsap'))
export const RUNTIME_PATHS: Record<string, string> = {
  '/runtime/gsap.min.js': join(gsapDist, 'gsap.min.js'),
  // The GSAP plugins the vendored components and the recipes use.
  '/runtime/CustomEase.min.js': join(gsapDist, 'CustomEase.min.js'),
  '/runtime/MotionPathPlugin.min.js': join(gsapDist, 'MotionPathPlugin.min.js'),
  '/runtime/hyperframes.iife.js': join(
    dirname(require.resolve('@hyperframes/core/package.json')),
    'dist',
    'hyperframe.runtime.iife.js'
  )
}
