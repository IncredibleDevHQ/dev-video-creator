// Some article readers prepend a title and publication date before the H1.
// Keep the date, and let the article's own heading carry its title once.
export const removeRepeatedTitle = (source: string, title?: string) => {
  const match = source.match(/^\s*([^#]*?)\n+(#{1,6}[ \t]+([^\n]+))(?:\n|$)/)
  if (!match) return source
  const heading = match[3].trim()
  const first = match[1].replace(/\s+/g, ' ').trim()
  if (title && title.trim().toLowerCase() !== heading.toLowerCase())
    return source
  if (!first.toLowerCase().startsWith(heading.toLowerCase())) return source
  const tail = first.slice(heading.length).trim()
  if (tail && !/^(?:[A-Z][a-z]+ \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2})$/.test(tail))
    return source
  return (
    (tail ? tail + '\n\n' : '') + source.slice(match[0].lastIndexOf(match[2]))
  )
}
