// The Assets dialog's per-object detail (D4): which parts the artwork keeps
// editable and which named behaviors it carries. Both answers come from the
// accepted record itself — part ids from the acceptance contract, behavior
// clips from the data-object-clip markers, which survive id-prefixing because
// they are data attributes, not ids.
export const artworkDetailFor = (asset: { parts?: Array<{ id?: string }>; svg?: string }): { parts: string[]; behaviors: string[] } => {
  const parts = (asset.parts || []).map(part => String(part.id || '')).filter(Boolean)
  const behaviors = [...new Set(Array.from(String(asset.svg || '').matchAll(/data-object-clip="([^"]+)"/g), match => match[1]))]
  return { parts, behaviors }
}

export const artworkDetailLine = (asset: { parts?: Array<{ id?: string }>; svg?: string }): string => {
  const { parts, behaviors } = artworkDetailFor(asset)
  const shown = parts.slice(0, 5).join(', ')
  const more = parts.length > 5 ? ` +${parts.length - 5}` : ''
  return `parts: ${shown || 'none'}${more}${behaviors.length ? ` · behaviors: ${behaviors.join(', ')}` : ''}`
}
