import { describe, expect, it } from 'vitest'
import { renderPage, statFigure, type OutlineScene, type PageBrand } from './source'

// F1 of the fresh end-to-end review: the schematic page for Anthropic's
// latency results printed "50" and "95" captioned "pTTFT" — the percentile
// in the label read as the measured value. A number in a name is a label.
const brand: PageBrand = { ground: '#f5f1ea', text: '#191919', muted: '#6b6b6b', line: '#d8d2c8', accent: '#c96442', secondary: '#5a7a9a', panel: '#ece6dc', display: 'font-family="serif"', body: 'font-family="sans-serif"', mono: 'font-family="monospace"' }

describe('a stat page states only the figures its labels state', () => {
  it('reads a figure only where the label states one', () => {
    expect(statFigure('99.9% uptime')).toEqual({ figure: '99.9%', caption: 'uptime' })
    expect(statFigure('Uptime 99.9%')).toEqual({ figure: '99.9%', caption: 'Uptime' })
    expect(statFigure('40 ms')).toEqual({ figure: '40 ms', caption: '' })
    expect(statFigure('3× faster')).toEqual({ figure: '3×', caption: 'faster' })
    expect(statFigure('10 regions')).toEqual({ figure: '10', caption: 'regions' })
    expect(statFigure('~60% lower')).toEqual({ figure: '~60%', caption: 'lower' })
    expect(statFigure('1,200 requests a second')).toEqual({ figure: '1,200', caption: 'requests a second' })
    // Percentiles, versions, model and product names, and years are labels.
    for (const label of ['p50 TTFT', 'p95 TTFT', 'v2 API', 'GPT-4 calls', 'H100 GPUs', 'Claude 3.5 Sonnet', 'S3 buckets', '2024 launch', 'Since 2019']) {
      expect(statFigure(label), label).toBeNull()
    }
  })

  it('renders percentile metrics as written, with the detail that holds their value', () => {
    const scene: OutlineScene = {
      title: 'Latency once the brain is decoupled',
      idea: 'Time to first token falls at every percentile',
      kind: 'numbers',
      seconds: 8,
      parts: [
        { kind: 'number', label: 'p50 TTFT', detail: 'roughly 60% lower' },
        { kind: 'number', label: 'p95 TTFT', detail: 'over 90% lower' },
      ] as OutlineScene['parts'],
      relations: [],
      narration: '',
      source: [],
    }
    const svg = renderPage(scene, 10, 13, brand, { title: 'Scaling Managed Agents', site: 'anthropic.com' })
    expect(svg).toContain('p50 TTFT')
    expect(svg).toContain('p95 TTFT')
    expect(svg).toContain('roughly 60% lower')
    expect(svg).toContain('over 90% lower')
    expect(svg).not.toMatch(/>(50|95)</)
    expect(svg).not.toContain('pTTFT')
    // A real figure still leads its stat.
    const figures = renderPage({ ...scene, parts: [{ kind: 'number', label: '99.9% uptime', detail: 'across regions' }] as OutlineScene['parts'] }, 10, 13, brand, { title: 'x', site: 'x' })
    expect(figures).toMatch(/font-weight="bold"[^>]*>99\.9%</)
  })
})
