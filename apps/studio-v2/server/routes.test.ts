import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// R01 of the project-flow rereview: a second handler for a route the server
// already served was never reached, and the studio read the shape it would
// have answered. Every route is handled once.
describe('the studio server routes', () => {
  it('handles each method and path once', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    const routes = [...source.matchAll(/request\.method === '([A-Z]+)' && (?:(\/\^.*?\$\/)\.test\(url\.pathname\)|url\.pathname === '([^']+)')/g)].map(match => `${match[1]} ${match[2] || match[3]}`)
    expect(routes.length).toBeGreaterThan(40)
    expect(routes.filter((route, index) => routes.indexOf(route) !== index)).toEqual([])
  })
})
