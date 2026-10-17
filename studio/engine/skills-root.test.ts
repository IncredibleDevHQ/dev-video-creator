import { afterEach, expect, it } from 'vitest'
import { creativeContext, skillsRoot } from './creative/stage'

afterEach(() => {
  delete process.env.MINIMAL_STUDIO_SKILLS_DIR
})

it('takes skills from the studio unless an experiment names another folder', () => {
  expect(skillsRoot()).toMatch(/studio\/skills$/)
  process.env.MINIMAL_STUDIO_SKILLS_DIR = '/tmp/variant-skills'
  expect(skillsRoot()).toBe('/tmp/variant-skills')
  expect(creativeContext('http://local').skillsDir).toBe('/tmp/variant-skills')
})
