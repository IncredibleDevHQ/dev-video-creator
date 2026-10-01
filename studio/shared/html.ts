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

// Document templates contain executable scripts where newlines affect ASI.
// Preserve their layout and all inserted bytes. The html alias enables formatting.
export const documentHtml = (
  parts: TemplateStringsArray,
  ...values: unknown[]
) =>
  parts.reduce(
    (result, part, index) =>
      result + part + (index < values.length ? String(values[index]) : ''),
    ''
  )
