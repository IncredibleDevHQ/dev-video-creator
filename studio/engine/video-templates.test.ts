import { expect, it } from 'vitest'
import {
  SLOT_TYPES,
  TEMPLATE_FAMILIES,
  VIDEO_TEMPLATES,
  assignSlots,
  presenterLayoutFor,
  sceneSlot,
  sceneTemplateSlot,
  speakerPlace,
  templateById
} from '../shared/video-templates'
import { templateSketch } from '../app/template-sketches'

it('gives every family two templates whose slots tile their length', () => {
  for (const family of TEMPLATE_FAMILIES)
    expect(
      VIDEO_TEMPLATES.filter((template) => template.family === family.id)
    ).toHaveLength(2)
  for (const template of VIDEO_TEMPLATES) {
    let at = 0
    for (const slot of template.slots) {
      expect(slot.from).toBe(at)
      expect(slot.to).toBeGreaterThan(slot.from)
      expect(SLOT_TYPES[slot.type]).toBeTruthy()
      at = slot.to
    }
    expect(at).toBe(template.seconds)
    expect(template.slots.at(-1)!.seam).toBe('end')
    expect(new Set(template.slots.map((slot) => slot.id)).size).toBe(
      template.slots.length
    )
  }
})

it('draws a sketch for every slot', () => {
  for (const template of VIDEO_TEMPLATES)
    for (const slot of template.slots)
      expect(templateSketch(slot.sketch)).toMatch(/^<svg[\s\S]+<\/svg>$/)
  expect(templateSketch('none')).toBe(
    '<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false"></svg>'
  )
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
  expect(presenterLayoutFor('off')).toBeNull()
})
