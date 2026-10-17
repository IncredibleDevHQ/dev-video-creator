/** Safe attachment names, including non-ASCII episode titles. */
export const downloadDisposition = (title: string, extension: string) => {
  const name =
    (title
      .replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, '-')
      .trim()
      .slice(0, 120) || 'notebook') +
    '.' +
    extension
  const fallback = name.replace(/[^\x20-\x7e]/g, '_')
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name).replace(/'/g, '%27')}`
}
