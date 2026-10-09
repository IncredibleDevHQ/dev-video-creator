import { expect, it } from 'vitest'
import { foreignRequest } from './request-guard'

const ask = (
  method: string,
  headers: Record<string, string>,
  env: NodeJS.ProcessEnv = {}
) => foreignRequest({ method, headers }, env)

it('answers the studio’s own page and the agent’s tool server', () => {
  expect(ask('GET', { host: 'localhost:4180' })).toBeNull()
  expect(
    ask('POST', {
      host: 'localhost:4180',
      origin: 'http://localhost:4180',
      'content-type': 'application/json'
    })
  ).toBeNull()
  // The agent's tool server: no origin, JSON, straight to the engine.
  expect(
    ask('POST', {
      host: '127.0.0.1:4320',
      'content-type': 'application/json; charset=utf-8'
    })
  ).toBeNull()
  // An upload from the studio's page.
  expect(
    ask('PUT', {
      host: '127.0.0.1:4180',
      origin: 'http://127.0.0.1:4180',
      'content-type': 'video/webm'
    })
  ).toBeNull()
})

it('refuses other sites, rebinding names and plain-text posts', () => {
  // A form or plain-text post from a page the creator visits.
  expect(
    ask('POST', {
      host: '127.0.0.1:4320',
      origin: 'https://example.com',
      'content-type': 'text/plain'
    })
  ).toBe('The studio refuses requests from other sites')
  expect(
    ask('POST', {
      host: '127.0.0.1:4320',
      origin: 'null',
      'content-type': 'application/json'
    })
  ).toBe('The studio refuses requests from other sites')
  expect(
    ask('POST', { host: '127.0.0.1:4320', 'content-type': 'text/plain' })
  ).toBe('Send the request as JSON')
  // A site whose name now points at this computer, reading or writing.
  expect(ask('GET', { host: 'rebound.example:4320' })).toBe(
    'The studio answers only on this computer'
  )
  expect(ask('GET', {})).toBe('The studio answers only on this computer')
})

it('answers on the harness origin’s name when one is set', () => {
  const env = { MINIMAL_STUDIO_HARNESS_ORIGIN: 'http://studio.internal:4320' }
  expect(
    ask(
      'POST',
      { host: 'studio.internal:4320', 'content-type': 'application/json' },
      env
    )
  ).toBeNull()
})
