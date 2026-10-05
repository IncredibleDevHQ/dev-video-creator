// What a drawn page must be before the studio keeps it: passive, local SVG on
// the 1280×720 canvas, its outline identity, and the page-master checker.
import { parseHTML } from 'linkedom'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import type { Outline } from '../source-outline'
import type { SketchFiles } from '../../render/types'
const execute = promisify(execFile)
const tags = new Set([
  'svg',
  'g',
  'defs',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'marker',
  'clippath',
  'mask',
  'lineargradient',
  'radialgradient',
  'stop',
  'title',
  'desc',
  'use'
])
export const pageSvgProblems = (svg: string) => {
  const problems: string[] = []
  if (Buffer.byteLength(svg) > 40000) problems.push('SVG exceeds 40000 bytes')
  if (/<!DOCTYPE|<!ENTITY/i.test(svg))
    problems.push('SVG must not declare entities')
  const { document } = parseHTML(svg)
  const root = document.querySelector('svg')
  if (!root || root.getAttribute('viewBox')?.trim() !== '0 0 1280 720')
    problems.push('SVG needs a 1280×720 canvas')
  for (const element of document.querySelectorAll('*')) {
    if (!tags.has(element.localName.toLowerCase()))
      problems.push(`Unsupported SVG element: ${element.localName}`)
    for (const attribute of element.attributes) {
      if (
        /(?:^|:)on/i.test(attribute.name) ||
        attribute.name.toLowerCase() === 'style'
      )
        problems.push(`Unsupported SVG attribute: ${attribute.name}`)
      if (
        /(?:^|:)href$/i.test(attribute.name) &&
        !attribute.value.startsWith('#')
      )
        problems.push('SVG references must be local fragments')
      if (
        /url\s*\(/i.test(attribute.value) &&
        !/^url\(\s*["']?#[a-zA-Z0-9_-]+["']?\s*\)$/.test(attribute.value)
      )
        problems.push('SVG paint references must be local fragments')
    }
  }
  return [...new Set(problems)]
}
export const validatePageReceipt = (
  files: SketchFiles,
  outline: Outline,
  pageOffset = 0
) => {
  const problems: string[] = []
  let receipt: {
    pages?: Array<{
      index: number
      file: string
      program: string
      title: string
      kind: string
      form: string
      topology: string
      checks: string
    }>
  } | null = null
  try {
    receipt = JSON.parse(
      typeof files['receipt.json'] === 'string' ? files['receipt.json'] : 'null'
    )
  } catch {
    problems.push('Receipt must be JSON')
  }
  const pages = Array.isArray(receipt?.pages) ? receipt.pages : []
  if (pages.length !== outline.scenes.length)
    problems.push('Receipt must contain every outline scene exactly once')
  const expected = new Set<string>()
  for (const [index, scene] of outline.scenes.entries()) {
    const page = pages[index]
    if (
      !page ||
      page.index !== index + 1 + pageOffset ||
      page.title !== scene.title ||
      page.kind !== scene.kind
    ) {
      problems.push(
        `Page ${index + 1} must retain its outline identity, title and kind`
      )
      continue
    }
    const prefix = String(index + 1 + pageOffset).padStart(2, '0')
    if (
      !new RegExp(`^${prefix}_[a-z0-9]+(?:[-_][a-z0-9]+){0,4}\\.svg$`).test(
        page.file
      )
    ) {
      problems.push(`Page ${index + 1} needs a numbered SVG file`)
      continue
    }
    expected.add(page.file)
    if (
      page.program !== page.file.replace(/\.svg$/, '.program.json') ||
      typeof files[page.program] !== 'string'
    )
      problems.push(`Page ${index + 1} needs its retained program`)
    if (
      typeof page.form !== 'string' ||
      !page.form.trim() ||
      typeof page.topology !== 'string' ||
      !page.topology.trim() ||
      page.checks !== 'pass'
    )
      problems.push(`Page ${index + 1} needs form, topology and passed checks`)
    const svg = files[page.file]
    if (typeof svg !== 'string') problems.push(`Missing ${page.file}`)
    else
      problems.push(
        ...pageSvgProblems(svg).map((problem) => `${page.file}: ${problem}`)
      )
  }
  for (const file of Object.keys(files).filter((name) => name.endsWith('.svg')))
    if (!expected.has(file)) problems.push(`Unexpected page: ${file}`)
  for (const file of ['contract.md', 'design_spec.md', 'spec_lock.md'])
    if (typeof files[file] !== 'string' || !files[file].trim())
      problems.push(`Missing ${file}`)
  return {
    problems,
    pages: pages
      .filter((page) => page && typeof page === 'object')
      .map((page) => ({ index: page.index, file: page.file }))
  }
}
export const checkPinnedPages = async (files: SketchFiles) => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-page-contract-'))
  try {
    for (const [name, file] of Object.entries(files)) {
      await mkdir(dirname(join(dir, name)), { recursive: true })
      await writeFile(
        join(dir, name),
        typeof file === 'string' ? file : Buffer.from(file.base64, 'base64')
      )
    }
    const script = fileURLToPath(
      new URL(
        '../../skills/page-master/scripts/check_pages.py',
        import.meta.url
      )
    )
    const result = await execute('python3', [script, dir], {
      timeout: 60000,
      maxBuffer: 2 * 1024 * 1024
    })
      .then((result) => result)
      .catch((error) => ({ stdout: String(error.stdout || ''), stderr: '' }))
    try {
      const report = JSON.parse(result.stdout)
      return report.ok
        ? []
        : ([
            ...(report.pages || []).flatMap(
              (page: { file: string; problems: string[] }) =>
                page.problems.map((problem) => `${page.file}: ${problem}`)
            ),
            ...(report.missing || []),
            ...(report.error ? [report.error] : [])
          ] as string[])
    } catch {
      return ['The pinned page checker could not complete']
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
