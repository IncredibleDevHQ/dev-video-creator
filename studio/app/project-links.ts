/** Context travels with outputs, so opening a canvas never loses the research trail. */
export type ProjectContext = {
  notebook?: string
  chat?: string | null
  node?: string | null
}
export const projectLink = (
  id: string,
  context: ProjectContext = {},
  target: Record<string, string> = {}
) => {
  const params = new URLSearchParams({ space: id })
  if (context.notebook) params.set('book', context.notebook)
  if (context.chat) params.set('chat', context.chat)
  if (context.node) params.set('node', context.node)
  for (const [key, value] of Object.entries(target)) params.set(key, value)
  return `/?${params}`
}
export const projectContext = (url: URL): ProjectContext => ({
  notebook: url.searchParams.get('book') || undefined,
  chat: url.searchParams.get('chat'),
  node: url.searchParams.get('node')
})

/** Notes have one canonical editor; engine snapshots are generated outputs. */
export function projectNotesTarget(url: URL, notebooks: { id: string }[]) {
  if (
    !url.searchParams.has('detail') ||
    url.searchParams.has('map') ||
    url.searchParams.get('view') !== 'notebook'
  )
    return null
  const id = url.searchParams.get('notebook')
  const notebook = notebooks.find((n) => n.id === id)
  return projectLink(
    url.searchParams.get('space')!,
    {
      ...projectContext(url),
      ...(notebook ? { notebook: notebook.id } : {})
    },
    { projectView: notebook ? 'notes' : 'canvas' }
  )
}
