import { lstat, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, it } from 'vitest'
import {
  kimiRunHome,
  kimiSessionUsage,
  runConfig,
  supportedEffort
} from './kimi-home'

const root = await mkdtemp(join(tmpdir(), 'studio-kimi-home-'))
afterAll(() => rm(root, { recursive: true, force: true }))

// A synthetic config shaped like Kimi Code's; no real provider settings.
const config = `default_model = "fixture/k3"

[models."fixture/k3"]
model = "k3"
support_efforts = [ "low", "high", "max" ]
max_output_size = 999

[models."fixture/other"]
model = "other"

[thinking]
enabled = false
effort = "max"
keep = "all"
`

it('asks for the nearest effort the model lists, rounding a light call down', () => {
  const k3 = ['low', 'high', 'max']
  expect(supportedEffort('medium', k3)).toBe('low')
  expect(supportedEffort('high', k3)).toBe('high')
  expect(supportedEffort('xhigh', k3)).toBe('high')
  expect(supportedEffort('low', ['high', 'max'])).toBe('high')
  expect(supportedEffort('medium', [])).toBe('medium')
})

it("writes the run's effort and response limit into a copy of the config", () => {
  const { config: written, effort } = runConfig(config, {
    effort: 'medium',
    maxOutputTokens: 32_000
  })
  expect(effort).toBe('low')
  expect(written).toContain('[thinking]\nenabled = true\neffort = "low"')
  expect(written).toContain('keep = "all"')
  expect(written).not.toContain('effort = "max"')
  expect(written.match(/max_output_size = 32000/g)).toHaveLength(2)
  expect(written).not.toContain('999')
  // A config without a thinking section gets one.
  expect(
    runConfig('default_model = "x"\n', { effort: 'high' }).config
  ).toContain('[thinking]\nenabled = true\neffort = "high"')
  expect(() => runConfig(config, { effort: 'loud' })).toThrow(
    'Unsupported thinking effort'
  )
})

it("sums the turns this run's session spent, from its wire log", async () => {
  const runId = 'fixture-run'
  const agents = join(
    root,
    'sessions',
    `wd_${runId}_0f0f0f`,
    'session_fixture-session',
    'agents'
  )
  await mkdir(join(agents, 'main'), { recursive: true })
  await mkdir(join(agents, 'helper'), { recursive: true })
  const turn = (time: number, usage: Record<string, number>) =>
    JSON.stringify({ type: 'usage.record', usageScope: 'turn', time, usage })
  await writeFile(
    join(agents, 'main', 'wire.jsonl'),
    [
      turn(100, { inputOther: 5, output: 5, inputCacheRead: 5 }),
      turn(2000, { inputOther: 10, output: 2, inputCacheRead: 100 }),
      JSON.stringify({ type: 'llm.request', time: 2100 }),
      turn(3000, { inputOther: 20, output: 4, inputCacheRead: 200 }),
      '{"type":"usage.rec'
    ].join('\n')
  )
  await writeFile(
    join(agents, 'helper', 'wire.jsonl'),
    turn(2500, { inputOther: 1, output: 1, inputCacheCreation: 7 })
  )
  const spent = {
    input: 31,
    output: 7,
    cacheRead: 300,
    cacheWrite: 7,
    final: true
  }
  // ACP names the session as its folder does, "session_<id>".
  for (const sessionId of ['session_fixture-session', 'fixture-session'])
    expect(
      await kimiSessionUsage({
        home: root,
        cwd: join(root, 'engine-workspaces', 'p', runId),
        sessionId,
        since: 1000
      })
    ).toEqual(spent)
  expect(
    await kimiSessionUsage({
      home: root,
      cwd: join(root, runId),
      sessionId: 'unknown',
      since: 0
    })
  ).toBeNull()
})

it("registers the run's installed skills in its own Kimi home", async () => {
  // A synthetic real home with a config and a skills folder of its own.
  const real = join(root, 'real-home')
  await mkdir(join(real, 'skills', 'users-own'), { recursive: true })
  await writeFile(join(real, 'config.toml'), config)
  await mkdir(join(real, 'sessions'), { recursive: true })
  const project = join(root, 'run')
  await mkdir(join(project, '.claude', 'skills', 'scene-producer'), {
    recursive: true
  })
  await writeFile(
    join(project, '.claude', 'skills', 'scene-producer', 'SKILL.md'),
    '---\nname: scene-producer\n---\n'
  )
  const previous = process.env.KIMI_CODE_HOME
  process.env.KIMI_CODE_HOME = real
  try {
    const { home, effort } = await kimiRunHome(project, { effort: 'medium' })
    // Kimi reads skills from $KIMI_CODE_HOME/skills (an ACP session ignores
    // --skills-dir): the run's own skills, a real folder, not the user's.
    const skills = await readdir(join(home, 'skills'))
    expect(skills).toEqual(['scene-producer'])
    expect((await lstat(join(home, 'skills'))).isSymbolicLink()).toBe(false)
    // Sessions still go to the real home, so a retry can resume.
    expect((await lstat(join(home, 'sessions'))).isSymbolicLink()).toBe(true)
    expect(effort).toBe('low')
  } finally {
    if (previous === undefined) delete process.env.KIMI_CODE_HOME
    else process.env.KIMI_CODE_HOME = previous
  }
})
