import { storeAsset } from './persistence'
import { fetchText, fetchBinary } from './source-fetch'
import {
  cutArticle,
  extractionOf,
  FALLBACK_PALETTE,
  type SourceRead
} from './source-document'
// ——— a document its code host serves (F3 of the Perplexity review) ———
// A GitHub file page is the host's chrome around the document: its article
// extractor found 17 words of navigation. The document is read from the
// host's raw contents instead, at the commit its address names, and the
// host's own colours and logo are left out of the brand.
export const githubDocumentOf = (url: URL) => {
  if (!/^(www\.)?github\.com$/i.test(url.hostname)) return null
  const parts = url.pathname
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part))
  if (parts.length === 2)
    return { owner: parts[0], repo: parts[1], ref: 'HEAD', path: 'README.md' }
  if (
    parts.length >= 5 &&
    (parts[2] === 'blob' || parts[2] === 'raw') &&
    /\.(md|markdown|mdx|txt|rst)$/i.test(parts[parts.length - 1])
  ) {
    return {
      owner: parts[0],
      repo: parts[1],
      ref: parts[3],
      path: parts.slice(4).join('/')
    }
  }
  return null
}

// Markdown as the text the outline reads: headings (either style) marked
// the same way, figures named, link targets dropped; code and tables kept.
export const markdownDocument = (markdown: string) => {
  const lines = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
  const out: string[] = []
  const headings: SourceRead['headings'] = []
  let fenced = false
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      out.push(line)
      continue
    }
    if (fenced) {
      out.push(line)
      continue
    }
    const next = lines[i + 1] || ''
    if (
      line.trim() &&
      /^\s*(=+|-{3,})\s*$/.test(next) &&
      !/^\s*([-*+]\s|\|)/.test(line)
    ) {
      const level = next.trim().startsWith('=') ? 1 : 2
      headings.push({ level, text: line.trim().slice(0, 140) })
      out.push(`${'#'.repeat(level)} ${line.trim()}`)
      i += 1
      continue
    }
    const atx = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (atx) {
      const level = Math.min(4, atx[1].length)
      headings.push({ level, text: atx[2].slice(0, 140) })
      out.push(`${'#'.repeat(level)} ${atx[2]}`)
      continue
    }
    out.push(
      line
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_match, alt: string) =>
          alt ? `(figure: ${alt})` : ''
        )
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    )
  }
  return {
    text: out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    headings
  }
}

export const readGithubDocument = async (
  doc: NonNullable<ReturnType<typeof githubDocumentOf>>,
  given: string,
  options: { projectId?: string }
): Promise<SourceRead | null> => {
  const path = doc.path.split('/').map(encodeURIComponent).join('/')
  let raw: string
  try {
    raw = (
      await fetchText(
        `https://raw.githubusercontent.com/${encodeURIComponent(doc.owner)}/${encodeURIComponent(doc.repo)}/${encodeURIComponent(doc.ref)}/${path}`,
        2 * 1024 * 1024,
        15_000,
        'text/plain,*/*;q=0.5'
      )
    ).text
  } catch {
    // Not a public document: the page itself is read instead.
    return null
  }
  // The exact commit the ref names, when the host says; unauthenticated
  // reads are rate limited, and then the ref stands.
  let commit: string | null = null
  try {
    const answer = (
      await fetchText(
        `https://api.github.com/repos/${encodeURIComponent(doc.owner)}/${encodeURIComponent(doc.repo)}/commits/${encodeURIComponent(doc.ref)}`,
        4096,
        8_000,
        'application/vnd.github.sha'
      )
    ).text.trim()
    if (/^[0-9a-f]{40}$/.test(answer)) commit = answer
  } catch {
    /* the ref stands */
  }
  const read = markdownDocument(raw)
  const warnings: string[] = []
  const cuts: string[] = []
  let text = read.text
  if (text.length > 24_000) {
    // Cut where a paragraph ends, saying so in the notes too (review 6).
    const cut = cutArticle(text)
    cuts.push(
      `The document was long; the first ${(cut.kept || '').length.toLocaleString('en')} characters were read, and ${cut.left.toLocaleString('en')} more were left out`
    )
    text = cut.text
    warnings.push(...cuts)
  }
  const title = (
    read.headings.find((heading) => heading.level === 1)?.text ||
    doc.path
      .split('/')
      .pop()!
      .replace(/\.[a-z]+$/i, '')
  ).slice(0, 160)
  const description = (
    text
      .split('\n\n')
      .find(
        (paragraph) =>
          paragraph.trim() && !/^(#|\||[-*+]\s|```)/.test(paragraph.trim())
      ) || ''
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)
  warnings.push(
    `Read ${doc.path} from ${doc.owner}/${doc.repo} at ${commit ? commit.slice(0, 7) : doc.ref}. GitHub's own page colours and logo are left out — choose the brand below.`
  )
  // The publisher's avatar is its mark on the host.
  const logos: SourceRead['logos'] = [
    {
      url: `https://github.com/${encodeURIComponent(doc.owner)}.png?size=200`,
      source: `${doc.owner} on GitHub`
    }
  ]
  const avatar = await fetchBinary(logos[0].url, 1024 * 1024)
  if (avatar && /png|jpe?g|webp/.test(avatar.contentType)) {
    try {
      const stored = await storeAsset({
        body: avatar.buffer,
        contentType: avatar.contentType,
        projectId: options.projectId,
        kind: 'brand-logo',
        extension: /png/.test(avatar.contentType)
          ? '.png'
          : /webp/.test(avatar.contentType)
            ? '.webp'
            : '.jpg'
      })
      logos[0].localUrl = `/objects/${stored.objectKey}`
    } catch {
      /* the original url still works for preview */
    }
  }
  return {
    kind: 'url',
    url: given,
    site: `github.com/${doc.owner}`,
    title,
    description,
    text,
    words: text.split(/\s+/).filter(Boolean).length,
    headings: read.headings.slice(0, 60),
    images: [],
    logos,
    palette: {
      ...FALLBACK_PALETTE,
      provenance: 'fallback',
      from: `${doc.owner}'s colours are not on GitHub's page`
    },
    fonts: {
      display: 'Segoe UI',
      body: 'Segoe UI',
      mono: 'Consolas',
      seen: []
    },
    warnings,
    extraction: {
      ...extractionOf(text, read.headings.length, `${doc.owner}/${doc.repo}`),
      notes: cuts
    },
    origin: {
      host: 'github',
      owner: doc.owner,
      repo: doc.repo,
      ref: doc.ref,
      commit,
      path: doc.path,
      url: given
    }
  }
}
