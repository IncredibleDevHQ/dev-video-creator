// Bundles the Electron main process, the sandboxed preload (must stay
// CommonJS) and the studio-v2 worker into dist-electron/.
//
// Worker externals, resolved at runtime from the monorepo root node_modules:
// - electron      only present inside Electron
// - puppeteer     downloads/finds a Chrome binary at runtime
// - gsap          server/index.ts does require.resolve('gsap') and serves the
//                 file from disk — bundling would break that path lookup
// - @hyperframes/*  index.ts resolves @hyperframes/core/package.json at
//                 runtime to serve the iife runtime; producer also spawns
//                 binaries relative to its own install
// - pg, minio     the postgres backend (persistence-pg.ts) is lazy-imported
//                 and never used with persistence: 'local', but esbuild would
//                 still statically pull these in; keep them external
// Everything else (node builtins excluded automatically) is bundled —
// including the workspace TS sources markdown-composition.
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const appDir = fileURLToPath(new URL('.', import.meta.url))
const studioV2Dir = fileURLToPath(new URL('../studio-v2/', import.meta.url))
const outdir = fileURLToPath(new URL('dist-electron/', import.meta.url))

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  logLevel: 'info',
}

await build({
  ...common,
  entryPoints: [`${appDir}src/main.ts`],
  outfile: `${outdir}main.js`,
  format: 'esm',
  external: ['electron'],
})

await build({
  ...common,
  entryPoints: [`${appDir}src/preload.ts`],
  outfile: `${outdir}preload.cjs`,
  format: 'cjs',
  external: ['electron'],
})

await build({
  ...common,
  entryPoints: [`${studioV2Dir}server/index.ts`],
  outfile: `${outdir}worker.mjs`,
  format: 'esm',
  external: ['electron', 'puppeteer', 'gsap', 'pg', 'minio', '@hyperframes/*'],
})

console.log('built dist-electron/main.js, preload.cjs, worker.mjs')
