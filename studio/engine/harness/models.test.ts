import { expect, it } from 'vitest'
import { codexCatalogFrom } from './models'
it('lists visible cached models, merges the configured choice and exposes no account fields', () => {
  const result = codexCatalogFrom('model = "custom-model"', {
    identity: 'private fixture',
    models: [
      {
        slug: 'model-a',
        display_name: 'Model A',
        visibility: 'list',
        privateField: 'never expose'
      },
      { slug: 'model-a', display_name: 'Model A', visibility: 'list' },
      { slug: 'internal-model', visibility: 'hide' },
      { visibility: 'list' },
      null
    ]
  })
  expect(result.options).toEqual([
    { id: 'model-a', label: 'Model A' },
    { id: 'custom-model', label: 'custom-model (your Codex config)' }
  ])
  expect(JSON.stringify(result)).not.toContain('private')
  expect(result.source).toContain('Account access is checked when you run')
})
it('falls back to configured models when the cache is missing or malformed', () => {
  expect(
    codexCatalogFrom('model = "configured-model"', null).options[0].id
  ).toBe('configured-model')
  expect(codexCatalogFrom('', { models: 'invalid' }).options).toEqual([])
})
