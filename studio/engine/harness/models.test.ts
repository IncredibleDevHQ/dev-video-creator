import { expect, it } from 'vitest'
import { claudeModels, codexCatalogFrom, kimiModelsFrom } from './models'
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
    { id: 'model-a', label: 'Model A', hint: 'model-a' },
    {
      id: 'custom-model',
      label: 'custom-model',
      hint: 'The model in your Codex config'
    }
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

it('offers Opus 5.5 by name, and only on a Claude Code that runs it', () => {
  // Seen live: 2.1.278 refused claude-opus-5-5, and its opus alias ran Opus 5.
  const old = claudeModels('2.1.278 (Claude Code)').options[0]
  expect(old).toEqual({
    id: 'claude-opus-5-5',
    label: 'Opus 5.5',
    unavailable:
      'needs Claude Code 2.1.280 or newer (found 2.1.278 (Claude Code))'
  })
  expect(claudeModels('2.1.293 (Claude Code)').options[0]).toEqual({
    id: 'claude-opus-5-5',
    label: 'Opus 5.5'
  })
})

it('names Kimi’s models plainly, with the id they run in the tooltip', () => {
  expect(
    kimiModelsFrom(
      'default_model = "kimi-code/k3"\n[models."kimi-code/k3"]\n[models.moonshot-k2-long]'
    ).options
  ).toEqual([
    { id: 'kimi-code/k3', label: 'K3', hint: 'kimi-code/k3' },
    { id: 'moonshot-k2-long', label: 'moonshot-k2-long' }
  ])
})
