export const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!
  )
export const button = (
  label: string,
  action: string,
  primary = false,
  disabled = false
) =>
  `<button type="button" data-action="${action}" ${primary ? 'class="primary"' : ''} ${disabled ? 'disabled' : ''}>${label}</button>`

// Format ordinary HTML without retaining indentation in its text nodes.
// Only literal layout whitespace is collapsed; inserted values stay unchanged.
// Callers escape user text before inserting it.
export const html = (parts: TemplateStringsArray, ...values: unknown[]) => {
  const layout = (part: string) => part.replace(/\s+/g, ' ')
  let result = layout(parts[0])
  for (let index = 0; index < values.length; index++)
    result += String(values[index]) + layout(parts[index + 1])
  return result
}
