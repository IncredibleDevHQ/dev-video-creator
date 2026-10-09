import { expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import { notesLength, NOTE_LIMIT } from '../shared/notes'
import { loadableFont } from '../shared/looks'
import { lengthForPages, lengthLabel } from '../shared/narratives'
import { modelName } from '../shared/agent-models'
import { notesOnly, presentationProgress } from '../app/progress'
import { notebookNextAction } from '../app/notebook-next-step'

const draft = {
  project: {
    id: 'n',
    title: 'Agents',
    source: 'Notes',
    slides: [],
    video: null
  },
  status: 'draft',
  error: null,
  events: []
} as unknown as Snapshot

it('counts the notes without the reader’s cut note', async () => {
  const kept = 'x'.repeat(NOTE_LIMIT)
  const cut = `${kept} … [cut: the article goes on for 4,512 more characters]`
  expect(notesLength(cut)).toBe(NOTE_LIMIT)
  expect(notesLength(`${kept}y`)).toBe(NOTE_LIMIT + 1)
  // As the editor's markdown writes it back: the cut note's brackets and
  // other characters escaped, & as an entity, a table padded. Each is still
  // one character, or one space, to the creator.
  const written = String.raw`a\_b\* &amp; |  c   |  d  |`
  expect(notesLength(written)).toBe(notesLength('a_b* & | c | d |'))
  // A table counts the same compact, padded or without its outer pipes.
  expect(notesLength('|a|b|\n|---|---|')).toBe(
    notesLength('| a     | b     |\n| ----- | ----- |')
  )
  expect(notesLength('a | b\n--- | ---')).toBe(
    notesLength('| a | b |\n| --- | --- |')
  )
  // A table's divider widened to its column, and a bare link written as a
  // link to itself: as the reader wrote them.
  expect(notesLength('| a | b |\n| -------- | :-------: |')).toBe(
    notesLength('| a | b |\n| --- | :---: |')
  )
  expect(
    notesLength('See [https://a.io/x](https://a.io/x) or <https://b.io>.')
  ).toBe('See https://a.io/x or https://b.io.'.length)
  // A cut note the editor moved inside a code block or a table, closing it
  // after the note, is still not counted; only a table's own divider rows
  // are shortened, so a long run of dashes in the text counts in full.
  const code = `\`\`\`\n${'x'.repeat(30)}\n… [cut: the article goes on for 9 more characters]\n\`\`\``
  expect(notesLength(code)).toBe(notesLength(`\`\`\`\n${'x'.repeat(30)}`))
  const table = `| a |\n| ${'y'.repeat(10)} … \\[cut: the article goes on for 9 more characters\\] |`
  expect(notesLength(table)).toBe(notesLength(`| a |\n| ${'y'.repeat(10)}`))
  expect(notesLength('-'.repeat(50))).toBe(50)
  // A link counts as its words, wherever it goes: the editor writes a bare
  // www link or an address as a link, and a shared reference in full each
  // time it is used (review 6: a README went from 23,783 to 34,858).
  expect(notesLength('[the post](https://a.io/x)')).toBe('the post'.length)
  expect(notesLength('Go to [www.a.io](http://www.a.io) now')).toBe(
    'Go to www.a.io now'.length
  )
  expect(notesLength('Mail [me@a.io](mailto:me@a.io)')).toBe(
    'Mail me@a.io'.length
  )
  const shared = 'See [the docs][d].\n\n[d]: https://a.io/docs/long/path'
  const expanded = Array.from(
    { length: 50 },
    () => 'See [the docs](https://a.io/docs/long/path "Docs").'
  ).join('\n\n')
  expect(notesLength(expanded)).toBe(50 * 'See the docs.'.length + 49)
  expect(notesLength(shared)).toBe('See [the docs][d].'.length)
  expect(notesLength('![a chart](https://a.io/c_(1).png)')).toBe(7)
  // Entities read as the characters they are, and lines stay lines, so
  // the words read from the notes keep their headings apart.
  const { compactNotes } = await import('../shared/notes')
  expect(compactNotes('# Title\n\n  a &lt;b&gt; &quot;c&quot;  d')).toBe(
    '# Title\na <b> "c" d'
  )
  // Counted as it is typed: a long run of spaces costs its length, once.
  const started = performance.now()
  expect(
    notesLength(`| a | b${' '.repeat(600_000)}c\n${' \n'.repeat(1e5)}`)
  ).toBe(5)
  expect(performance.now() - started).toBeLessThan(1_000)
  // A code block is written back with a fence its code can't close.
  const { codeFence } = await import('../shared/notes')
  expect(codeFence('const a = 1')).toBe('```')
  expect(codeFence('```js\nx()\n```')).toBe('````')
  expect(codeFence('use ````a```` here')).toBe('`````')
  expect(
    notesLength(
      'x'.repeat(NOTE_LIMIT - 3) +
        String.raw`a\_ … \[cut: the article goes on for 4,512 more characters\]`
    )
  ).toBe(NOTE_LIMIT - 1)
})

it('keeps a font only if it can load, else the nearest built-in', () => {
  expect(loadableFont('Inter')).toEqual({ value: 'Inter', replaced: false })
  expect(loadableFont('Georgia')).toEqual({ value: 'Georgia', replaced: false })
  expect(loadableFont('tiemposText')).toEqual({
    value: 'Georgia',
    replaced: true
  })
  expect(loadableFont('styreneA')).toEqual({ value: 'Inter', replaced: true })
  expect(loadableFont('JetBrains Mono').value).toBe('ui-monospace')
  // Windows' own fonts don't show on a Mac: the nearest built-in, said so;
  // the system's own fonts show as they are.
  expect(loadableFont('Segoe UI')).toEqual({
    value: 'system-ui',
    replaced: true
  })
  expect(loadableFont('Consolas')).toEqual({
    value: 'ui-monospace',
    replaced: true
  })
  expect(loadableFont('system-ui')).toEqual({
    value: 'system-ui',
    replaced: false
  })
})

it('says on the notebook’s look when a site’s fonts stand in', async () => {
  const { withLook, fontsStandingIn } = await import('./looks')
  // Each stand-in once, the words agreeing with how many there are.
  expect(fontsStandingIn([{ value: 'Inter' }, { value: 'Inter' }])).toBe(
    'Its fonts can’t be loaded here, so Inter stands in.'
  )
  expect(fontsStandingIn([{ value: 'Georgia' }])).toBe(
    'One of its fonts can’t be loaded here, so Georgia stands in.'
  )
  expect(fontsStandingIn([{ value: 'Georgia' }, { value: 'Inter' }])).toBe(
    'Its fonts can’t be loaded here, so Georgia and Inter stand in.'
  )
  // A stand-in is named as the font menu names it.
  expect(fontsStandingIn([{ value: 'system-ui' }])).toBe(
    'One of its fonts can’t be loaded here, so System sans stands in.'
  )
  const { LOOKS } = await import('../shared/looks')
  const site = {
    ...LOOKS[0],
    id: 'site',
    name: 'anthropic.com',
    description:
      'Colours read from anthropic.com. Its fonts can’t be loaded here, so Georgia and Inter stand in.'
  }
  expect(withLook(undefined, site).look).toEqual({
    id: 'site',
    name: 'anthropic.com',
    note: site.description
  })
  // A look of the studio's own describes itself.
  expect(withLook(undefined, LOOKS[0]).look).toEqual({
    id: LOOKS[0].id,
    name: LOOKS[0].name
  })
})

it('says lengths in seconds or whole and half minutes', () => {
  expect(lengthLabel([45, 90])).toBe('45–90 s')
  expect(lengthLabel([80, 130])).toBe('1.5–2 min')
  expect(lengthLabel([360, 600])).toBe('6–10 min')
  // Ends that round to one are said once.
  expect(lengthLabel([125, 130])).toBe('about 2 min')
  // Ten wireframes told thoroughly stay about ten wireframes long.
  expect(lengthForPages(10, 'thorough')).toEqual([300, 600])
})

it('names models plainly', () => {
  expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelName('opus')).toBe('Opus')
  expect(modelName('kimi-code/k3')).toBe('K3')
})

it('lets the Wireframe tab show an empty stage whose button starts the run', () => {
  // A new notebook is a draft of notes only: its Wireframe tab is not sent
  // back to the notes; one still reading, or failed to read, keeps to them.
  const fresh = { ...draft, sourceOnly: true } as typeof draft
  expect(notesOnly(fresh)).toBe(false)
  expect(notesOnly({ ...fresh, status: 'reading' } as typeof draft)).toBe(true)
  expect(notesOnly({ ...fresh, status: 'failed' } as typeof draft)).toBe(true)
  const card = presentationProgress(draft)
  expect(card).toContain('No wireframes yet')
  expect(card).toContain('data-action="create-presentation"')
  expect(notebookNextAction(draft, true)).toContain('Creating…')
  expect(notebookNextAction(draft, true)).toContain('aria-busy="true"')
  expect(notebookNextAction(draft, true)).toContain('disabled')
})

it('cuts a long article where a paragraph ends, never inside code, and says so', async () => {
  const { cutArticle } = await import('./source-document')
  const para = 'Words in a paragraph. '.repeat(40)
  const article = `${para}\n\n${para}\n\n\`\`\`\n${'code();\n'.repeat(4000)}\`\`\`\n\n${para}`
  const { text, left, kept } = cutArticle(article, 24_000)
  // The note on a line of its own, after the block it closes.
  expect(text).toMatch(
    /\n\n… \[cut: the article goes on for [\d,]+ more characters\]$/
  )
  expect((text.match(/^\`\`\`/gm) || []).length % 2).toBe(0)
  expect(left).toBe(article.length - kept.length)
  // A stray fence early on loses nothing before the cut, and inline code
  // that starts a line is not a fence.
  const tail = `${para}\n\n`.repeat(40)
  expect(cutArticle(`\`\`\`\n${tail}`, 24_000).kept.length).toBeGreaterThan(
    19_000
  )
  expect(
    cutArticle(`\`\`\`a\`\`\` inline\n\n${tail}`, 24_000).kept.length
  ).toBeGreaterThan(19_000)
  // A block in a list item is closed where its own fence stands, so the
  // note after it is not code (review 6).
  const step = `1. Run it:\n\n   \`\`\`sh\n${'   make all\n\n'.repeat(3000)}   \`\`\``
  const listed = cutArticle(`${para}\n\n${step}`, 24_000)
  expect(listed.text).toMatch(/\n   \`\`\`\n\n… \[cut: [^\]]+\]$/)
  // Four spaces in, outside a list, a fence is a line of indented code: it
  // opens nothing to close.
  const indented = `${para}\n\n    \`\`\`\n${'    code();\n'.repeat(3000)}`
  expect(cutArticle(indented, 24_000).text).toMatch(/code\(\);\n\n… \[cut/)
  // Line ends as Windows writes them count as one, and say what was cut.
  const windows = cutArticle(`${'Line.\r\n'.repeat(4000)}`, 24_000)
  expect(windows.left).toBe(0)
  expect(windows.kept).toBe('Line.\n'.repeat(4000))
  // Short enough, kept whole.
  expect(cutArticle('Short.', 24_000)).toEqual({
    text: 'Short.',
    kept: 'Short.',
    left: 0
  })
})
