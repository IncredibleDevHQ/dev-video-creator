// The capability catalog a creative plan may name recipes from.
//
// The pinned Hyperframes animation skill publishes its recipes as indexes:
// atomic rules, whole-shot blueprints and a short list of techniques. A plan
// names a recipe by its catalog id so construction can later read that exact
// recipe; a name that is not in the pinned catalog is either an adaptation the
// plan says it is, or a mistake the checker reports. It is never silently
// dropped (the upstream packet builder does drop unknown rule ids, which is
// why the product checks them itself).
//
// Being catalogued is not being supported. Until a capability has been proven
// in the installed runtime, it is listed as unverified, and a plan that uses
// it carries that as an open construction risk.

export type CapabilityKind = 'rule' | 'blueprint' | 'technique'

export type CapabilityEntry = {
  id: string
  kind: CapabilityKind
  summary: string
  // Where the recipe's own instructions live in the upstream skill.
  source: string
  tags: string[]
  // Whether this bundle ships the recipe body, or only its index line.
  bodyVendored: boolean
  // Proven to work in the installed Hyperframes runtime (H0), or not yet.
  verifiedInInstalledRuntime: boolean
}

export type CapabilityCatalog = {
  upstreamCommit: string
  runtime: Record<string, string>
  entries: CapabilityEntry[]
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

// `<coordinate-target-zoom path="rules/coordinate-target-zoom.md">… Tags: camera, zoom</coordinate-target-zoom>`
export const parseRulesIndex = (markdown: string): CapabilityEntry[] => {
  const seen = new Map<string, CapabilityEntry>()
  const pattern = /<([a-z0-9][a-z0-9-]*) path="([^"]+)">([\s\S]*?)<\/\1>/g
  for (const match of markdown.matchAll(pattern)) {
    const [, id, path, body] = match
    if (id === 'rules') continue
    const tagText = /Tags:\s*([^\n<]+)$/i.exec(clean(body))?.[1] || ''
    const summary = clean(body.replace(/Tags:[^\n<]*$/i, ''))
    const tags = tagText.split(',').map(tag => tag.trim()).filter(Boolean)
    // A rule listed under two headings is one rule; its tags accumulate.
    const existing = seen.get(id)
    if (existing) {
      existing.tags = [...new Set([...existing.tags, ...tags])]
      continue
    }
    seen.set(id, {
      id,
      kind: 'rule',
      summary,
      source: `skills/hyperframes-animation/${path}`,
      tags,
      bodyVendored: false,
      verifiedInInstalledRuntime: false,
    })
  }
  return [...seen.values()]
}

// `<blueprint id="camera-journey" roles="Benefits, Key_Feature" duration="5.6–11.1s">…</blueprint>`
export const parseBlueprintsIndex = (markdown: string): CapabilityEntry[] => {
  const entries: CapabilityEntry[] = []
  const pattern = /<blueprint id="([^"]+)"([^>]*)>([\s\S]*?)<\/blueprint>/g
  for (const match of markdown.matchAll(pattern)) {
    const [, id, attributes, body] = match
    const roles = /roles="([^"]*)"/.exec(attributes)?.[1] || ''
    entries.push({
      id,
      kind: 'blueprint',
      summary: clean(body),
      source: `skills/hyperframes-animation/blueprints/${id}.md`,
      tags: roles.split(',').map(role => role.trim()).filter(Boolean),
      bodyVendored: false,
      verifiedInInstalledRuntime: false,
    })
  }
  return entries
}

// The techniques reference names its techniques in its contents list.
export const parseTechniques = (markdown: string): CapabilityEntry[] => {
  const contents = /## Contents\s*\n([\s\S]*?)\n\s*\n/.exec(markdown)?.[1] || ''
  return contents
    .split('\n')
    .map(line => /^-\s+(.+?)\s*$/.exec(line)?.[1] || '')
    .filter(title => title && !/^when to use/i.test(title))
    .map(title => ({
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      kind: 'technique' as const,
      summary: title,
      source: 'skills/hyperframes-animation/techniques.md',
      tags: [],
      bodyVendored: true,
      verifiedInInstalledRuntime: false,
    }))
}

export const buildCapabilityCatalog = (input: {
  upstreamCommit: string
  runtime: Record<string, string>
  rulesIndex: string
  blueprintsIndex: string
  techniques: string
}): CapabilityCatalog => ({
  upstreamCommit: input.upstreamCommit,
  runtime: input.runtime,
  entries: [
    ...parseRulesIndex(input.rulesIndex),
    ...parseBlueprintsIndex(input.blueprintsIndex),
    ...parseTechniques(input.techniques),
  ],
})

export const findCapability = (catalog: Pick<CapabilityCatalog, 'entries'>, kind: CapabilityKind, id: string) =>
  catalog.entries.find(entry => entry.kind === kind && entry.id === id) || null
