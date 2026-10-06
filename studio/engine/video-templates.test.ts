import { expect, it } from 'vitest'
import {
  SEAM_LABELS,
  SLOT_TYPES,
  SPEAKER_LABELS,
  STORY_GROUPS,
  TEMPLATE_STORIES,
  VIDEO_TEMPLATES,
  assignSlots,
  cameraShare,
  presenterLayoutFor,
  sceneSlot,
  sceneTemplateSlot,
  slotTable,
  speakerPlace,
  storyTemplates,
  templateById
} from '../shared/video-templates'
import { templateSketch } from '../app/template-sketches'

it('tells every story more than one way, each slot a known kind', () => {
  expect(new Set(VIDEO_TEMPLATES.map((item) => item.id)).size).toBe(
    VIDEO_TEMPLATES.length
  )
  for (const story of TEMPLATE_STORIES) {
    expect(STORY_GROUPS.some((group) => group.id === story.group)).toBe(true)
    expect(storyTemplates(story.id).length).toBeGreaterThan(1)
  }
  for (const template of VIDEO_TEMPLATES) {
    expect(TEMPLATE_STORIES.some((story) => story.id === template.story)).toBe(
      true
    )
    let at = 0
    for (const slot of template.slots) {
      expect(slot.from).toBe(at)
      expect(slot.to).toBeGreaterThan(slot.from)
      expect(SLOT_TYPES[slot.type]).toBeTruthy()
      expect(SPEAKER_LABELS[slot.speaker]).toBeTruthy()
      expect(SEAM_LABELS[slot.seam]).toBeTruthy()
      expect(slot.move).toMatch(/\.$/)
      at = slot.to
    }
    expect(at).toBe(template.seconds)
    if (template.cover)
      expect(template.slots.map((slot) => slot.id)).toContain(template.cover)
    expect(template.slots.at(-1)!.seam).toBe('end')
    expect(
      template.slots.slice(0, -1).every((slot) => slot.seam !== 'end')
    ).toBe(true)
    expect(new Set(template.slots.map((slot) => slot.id)).size).toBe(
      template.slots.length
    )
  }
  // The first six keep their ids, so videos made with them still open.
  for (const id of [
    'design-decision',
    'incident',
    'how-it-works',
    'engineering-story',
    'launch-demo',
    'feature-deep-dive'
  ])
    expect(templateById(id)).toBeTruthy()
})

it('reads a storyboard table, one slot a row', () => {
  expect(
    slotTable(`
open | Open | 8 | captions | over | headcaps | cut | Words over you. | caption-kinetic-slam asr-keyword-glow
close | Close | 12 | speaker | beside | recap | end | Three points. |
`)
  ).toEqual([
    {
      id: 'open',
      role: 'Open',
      from: 0,
      to: 8,
      type: 'captions',
      speaker: 'over',
      sketch: 'headcaps',
      seam: 'cut',
      move: 'Words over you.',
      builds: ['caption-kinetic-slam', 'asr-keyword-glow']
    },
    {
      id: 'close',
      role: 'Close',
      from: 8,
      to: 20,
      type: 'speaker',
      speaker: 'beside',
      sketch: 'recap',
      seam: 'end',
      move: 'Three points.',
      builds: []
    }
  ])
})

it('says how much of a template puts the speaker on camera', () => {
  expect(cameraShare(templateById('launch-teaser')!)).toBe(0)
  expect(cameraShare(templateById('debug-screencast')!)).toBe(1)
  const share = cameraShare(templateById('launch-demo')!)
  expect(share).toBeGreaterThan(0.4)
  expect(share).toBeLessThan(0.5)
})

it('draws the speaker only where a slot puts them', () => {
  for (const template of VIDEO_TEMPLATES)
    for (const slot of template.slots) {
      const where = `${template.id} ${slot.id}`
      const camera =
        /sk-cam|sk-ring/.test(templateSketch(slot.sketch)) ||
        slot.sketch === 'keynote'
      if (slot.speaker === 'off') expect(camera, where).toBe(false)
      if (slot.speaker === 'full' || slot.speaker === 'over')
        expect(camera, where).toBe(true)
      if (slot.type === 'captions') expect(slot.speaker, where).toBe('over')
      if (slot.type === 'speaker') expect(slot.speaker, where).not.toBe('off')
    }
})

it('draws a sketch for every slot', () => {
  const blank =
    '<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false"></svg>'
  expect(templateSketch('none')).toBe(blank)
  for (const template of VIDEO_TEMPLATES)
    for (const slot of template.slots) {
      const sketch = templateSketch(slot.sketch)
      expect(sketch, `${template.id} ${slot.id}`).not.toBe(blank)
      expect(sketch).toMatch(/^<svg[\s\S]+<\/svg>$/)
    }
})

it('opens and closes on the template, and spreads the scenes between', () => {
  const template = templateById('how-it-works')!
  const roles = (count: number) =>
    assignSlots(template, count).map((slot) => slot.id)
  expect(roles(0)).toEqual([])
  expect(roles(1)).toEqual(['mechanism'])
  expect(roles(2)).toEqual(['hook', 'recap'])
  expect(roles(6)).toEqual([
    'hook',
    'example',
    'mechanism',
    'breaking-point',
    'pattern',
    'recap'
  ])
  expect(roles(9)).toEqual([
    'hook',
    'example',
    'example',
    'mechanism',
    'mechanism',
    'breaking-point',
    'breaking-point',
    'pattern',
    'recap'
  ])
  // A creator's choice for a scene wins.
  const scenes = [{ id: 'a' }, { id: 'b', slot: 'pattern' }, { id: 'c' }]
  expect(sceneSlot(template, scenes, 'b')!.id).toBe('pattern')
  expect(sceneSlot(template, scenes, 'c')!.id).toBe('recap')
  expect(sceneSlot(template, scenes, 'x')).toBeUndefined()
})

it('finds the slot a scene plays only when the video has a template', () => {
  const scenes = [{ id: 'a' }, { id: 'b' }, { id: 'c', slot: 'proof' }]
  expect(sceneTemplateSlot({ settings: {}, scenes }, 'a')).toBeNull()
  expect(sceneTemplateSlot(null, 'a')).toBeNull()
  const video = { settings: { template: 'launch-demo' }, scenes }
  expect(sceneTemplateSlot(video, 'a')!.slot.id).toBe('result-first')
  expect(sceneTemplateSlot(video, 'c')!.slot.id).toBe('proof')
  expect(sceneTemplateSlot(video, 'x')).toBeNull()
})

it('places the speaker by the creator’s presence', () => {
  const [decision, context, proposal] = templateById('design-decision')!.slots
  expect(speakerPlace(decision, 'high')).toBe('beside')
  expect(speakerPlace(proposal, 'high')).toBe('corner')
  // Presence decides when they appear; the slot only frames them.
  expect(speakerPlace(proposal, 'low')).toBe('corner')
  expect(speakerPlace(decision, 'off')).toBe('off')
  expect(speakerPlace(context, 'high')).toBe('off')
  expect(presenterLayoutFor('beside')).toBe('beside-slide')
  expect(presenterLayoutFor('corner')).toBe('corner')
  expect(presenterLayoutFor('full')).toBe('full-screen')
  expect(presenterLayoutFor('over')).toBe('full-screen')
  expect(presenterLayoutFor('off')).toBeNull()
})
