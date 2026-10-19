import { afterAll, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const calls = vi.hoisted(() => ({
  spawn: vi.fn().mockResolvedValue({ exitCode: 0 })
}))
vi.mock('./util', async (original) => ({
  ...(await original<typeof import('./util')>()),
  probeVersion: vi.fn().mockResolvedValue({ ok: true, version: '2.1.293' }),
  spawnJsonLines: calls.spawn
}))
import { createCodexAdapter } from './codex'
import { createClaudeCodeAdapter } from './claude-code'
const root = await mkdtemp(join(tmpdir(), 'harness-effort-'))
// Do not read or copy the user's real credentials in a fixture test.
vi.stubEnv('CODEX_HOME', root)
afterAll(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})
const context = {
  origin: 'http://127.0.0.1:4320',
  mcpShimPath: '/fixture/shim.mjs',
  skillsDir: root
}
for (const resumeId of [undefined, 'saved-session']) {
  it(`passes exact Codex ultra effort ${resumeId ? 'on resume' : 'on a new chat'}`, async () => {
    await createCodexAdapter(context).run(
      {
        id: 'run',
        skill: 'story',
        projectDir: join(root, 'codex'),
        resumeId,
        inputs: {
          task: 'fixture',
          model: 'gpt-fixture',
          effort: 'ultra',
          explicitEffort: true
        }
      },
      () => {},
      new AbortController().signal
    )
    const call = calls.spawn.mock.calls.at(-1)![0]
    expect(call.args).toContain('model_reasoning_effort="ultra"')
    expect(call.args).toContain('gpt-fixture')
    expect(call.args).toContain('--skip-git-repo-check')
    if (resumeId) {
      expect(call.args).toContain(resumeId)
      expect(call.args).toContain('sandbox_mode="workspace-write"')
    } else expect(call.args).toContain('workspace-write')
    const config = await readFile(
      join(root, 'codex/.codex/config.toml'),
      'utf8'
    )
    expect(config).toContain('[mcp_servers.studio.tools.context_1_repo_read]')
    expect(config).toContain(
      '[mcp_servers.studio.tools.research_read_ancestor]'
    )
    expect(config).not.toContain('danger-full-access')
    expect(config).not.toContain('[mcp_servers.studio.tools.produce_')
  })
}
it('passes Claude effort to resumed sessions and overrides inherited effort only for this process', async () => {
  await createClaudeCodeAdapter(context).run(
    {
      id: 'run',
      skill: 'story',
      projectDir: join(root, 'claude'),
      resumeId: 'saved-session',
      inputs: { task: 'fixture', effort: 'max', explicitEffort: true }
    },
    () => {},
    new AbortController().signal
  )
  const call = calls.spawn.mock.calls.at(-1)![0]
  expect(
    call.args.slice(
      call.args.indexOf('--effort'),
      call.args.indexOf('--effort') + 2
    )
  ).toEqual(['--effort', 'max'])
  expect(call.args).toContain('saved-session')
  expect(call.env.CLAUDE_CODE_EFFORT_LEVEL).toBe('max')
})
