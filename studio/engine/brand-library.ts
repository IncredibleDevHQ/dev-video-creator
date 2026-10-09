import { randomUUID } from 'node:crypto'
import type { SavedBrand } from '../shared/settings'
import type { SourceRead } from './source-document'
import {
  loadSetting,
  saveSetting,
  withOperationLock,
  readRow
} from './persistence'
import { validateBranding } from './branding'
import { readSourceUrl } from './source-reader'
import { Refusal } from './refusal'

export const brandDomain = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
      ? parsed.hostname.toLowerCase().replace(/^www\./, '')
      : null
  } catch {
    return null
  }
}
export const loadBrandLibrary = async (): Promise<SavedBrand[]> =>
  ((await loadSetting('brand-library')) as SavedBrand[] | null) || []

export const saveLibraryBrand = async (raw: unknown): Promise<SavedBrand> => {
  const input = raw as {
    brand: unknown
    domain?: string | null
    overwriteId?: string
    expectedUpdatedAt?: string
  }
  const brand = await validateBranding(input?.brand)
  const domain = input.domain ? brandDomain(`https://${input.domain}`) : null
  if (input.domain && domain !== input.domain)
    throw new Refusal('Use a normalised website domain')
  return withOperationLock('brand-library', async () => {
    const library = await loadBrandLibrary()
    const existing = input.overwriteId
      ? library.find((item) => item.id === input.overwriteId)
      : undefined
    if (
      input.overwriteId &&
      (!existing || existing.updatedAt !== input.expectedUpdatedAt)
    )
      throw new Refusal(
        'This saved brand changed. Reload before overwriting it.'
      )
    if (
      domain &&
      library.some((item) => item.domain === domain && item.id !== existing?.id)
    )
      throw new Refusal(
        'A brand is already saved for this domain. Restore it or explicitly overwrite it.'
      )
    const entry: SavedBrand = {
      id: existing?.id || randomUUID(),
      domain,
      brand,
      updatedAt: new Date().toISOString()
    }
    await saveSetting('brand-library', [
      ...library.filter((item) => item.id !== entry.id),
      entry
    ])
    return entry
  })
}

// Detect a fresh suggestion without replacing the notebook's edited article or saved brand.
export const redetectBrand = async (id: string) => {
  const source = await readRow<SourceRead>('sources', id)
  if (!source?.url || !brandDomain(source.url))
    throw new Refusal('This notebook has no website to detect')
  const detected = await readSourceUrl(source.url, { projectId: id })
  return {
    ...source,
    palette: detected.palette,
    fonts: detected.fonts,
    logos: detected.logos,
    site: detected.site
  }
}
