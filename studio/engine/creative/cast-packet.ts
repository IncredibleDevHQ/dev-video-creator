import type { Project } from '../../shared/model'
import { fingerprintOf } from '../planning/fingerprint'
import { readAsset } from '../persistence'
import { ensureVisualCast } from './visual-cast'
/** Carry the original browser-extracted, pixel-verified artwork into all creative stages. */
export const prepareCastPacket = async (project: Project, slideId: string) => {
  const revision = fingerprintOf(
    project.slides.map(({ id, svg }) => ({ id, svg }))
  )
  const cast = await ensureVisualCast({
    notebook: project.id,
    revision,
    pages: project.slides.map((slide) => ({
      scene: slide.id,
      title: slide.title,
      svg: slide.svg || '',
      sourcePassages: slide.evidence || []
    })),
    theme: { brand: { accent: project.branding?.accent || '#635bff' } },
    retryFailed: true
  })
  if (cast.status !== 'ready')
    throw new Error(
      `Presentation artwork extraction failed: ${cast.error || 'Try again'}`
    )
  const pages = cast.pages.filter((page) => page.scene === slideId),
    entries = cast.entries.filter(
      (entry) => entry.identity.base.page === slideId
    )
  const media: Record<string, Buffer> = {},
    pageRefs = []
  for (const page of pages) {
    media['packet/references/page.svg'] = await readAsset(page.page.objectKey)
    media['packet/references/page.png'] = await readAsset(
      page.preview.objectKey
    )
    if (page.contactSheet)
      media['packet/references/visual-cast.png'] = await readAsset(
        page.contactSheet.objectKey
      )
    pageRefs.push({
      scene: page.scene,
      title: page.title,
      reference: 'references/page.svg',
      preview: 'references/page.png',
      contactSheet: page.contactSheet ? 'references/visual-cast.png' : null,
      furniture: page.furniture,
      notes: page.notes
    })
  }
  for (const entry of entries) {
    const folder = `packet/assets/${entry.id}`
    media[`${folder}/asset.svg`] = await readAsset(entry.artwork.svg.objectKey)
    media[`${folder}/preview.png`] = await readAsset(
      entry.artwork.thumbnail.objectKey
    )
    media[`${folder}/parts.json`] = Buffer.from(
      JSON.stringify({ parts: entry.parts, rig: entry.rig })
    )
  }
  const assets = entries
    .filter(
      (entry) => entry.libraryKey && entry.verification.status === 'verified'
    )
    .map((entry) => ({
      key: entry.libraryKey!,
      role: `${entry.meaning.label}: ${entry.identity.entityKind || entry.kind}`,
      parts: entry.parts.map((part) => part.name || part.id)
    }))
  const visualCast = {
    status: 'ready',
    cast: cast.id,
    extractor: cast.version,
    base: cast.base,
    pages: pageRefs,
    entries: entries.map((entry) => ({
      id: entry.id,
      libraryKey: entry.libraryKey,
      kind: entry.kind,
      label: entry.meaning.label,
      detail: entry.meaning.detail,
      entity: entry.identity.entity,
      entityKind: entry.identity.entityKind,
      object: entry.identity.object,
      objectId: entry.identity.objectId,
      page: entry.identity.base.page,
      node: entry.identity.base.node,
      interactions: entry.meaning.interactions,
      parts: entry.parts,
      rig: entry.rig,
      confidence: entry.confidence,
      verification: entry.verification,
      size: entry.artwork.viewBox,
      themeBindings: entry.artwork.themeBindings,
      fonts: entry.artwork.fonts,
      files: {
        svg: `assets/${entry.id}/asset.svg`,
        preview: `assets/${entry.id}/preview.png`,
        parts: `assets/${entry.id}/parts.json`
      }
    })),
    rule: 'Inspect the page PNG and contact sheet. Only verified entries may be reused as equivalent artwork. The scene must explain the source through changes in objects, not slide fades.'
  }
  return {
    visualCast,
    media,
    assets,
    assetKeys: assets.map((asset) => asset.key)
  }
}
