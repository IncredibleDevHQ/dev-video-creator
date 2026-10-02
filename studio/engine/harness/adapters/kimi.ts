// Kimi ACP streams activity while the model is working, including before a
// complete tool call. Each run keeps its own configuration and workspace.
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { HarnessAdapter, HarnessContext, HarnessRun } from '../types'
import { homedir } from 'node:os'
import { runAcp } from './acp'
import { probeVersion, studioMcpUrl } from './util'
import { resolveSkillDir } from '../skills-install'
import { kimiModels } from '../models'

// Kimi reads its settings from KIMI_CODE_HOME. A drawing run wants the
// model thinking hard, but the effort lives in the user's own config and
// their interactive sessions are theirs — so a run gets a home of its own:
// everything symlinked through to the real one, with a copy of the config
// with the requested thinking effort. Their global setting is untouched.
const homeWithEffort = async (projectDir: string, effort: string) => {
  const real = process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code')
  const config = await readFile(join(real, 'config.toml'), 'utf8')
  if (!['low', 'medium', 'high', 'max'].includes(effort))
    throw new Error('Unsupported thinking effort')
  const thinking = `[thinking]\nenabled = true\neffort = "${effort}"\n`
  const raised = /^\[thinking\][^[]*/m.test(config)
    ? config.replace(/^\[thinking\][^[]*/m, (section) => {
        const other = section
          .split('\n')
          .slice(1)
          .filter((line) => !/^\s*(?:effort|enabled)\s*=/.test(line))
          .join('\n')
        return `${thinking}${other}\n`
      })
    : `${config}\n${thinking}`
  const home = join(projectDir, 'motion', 'kimi-home')
  // Keep this run's CLI sessions so a retry can resume its actual context.
  await mkdir(home, { recursive: true })
  for (const entry of await readdir(real)) {
    if (entry === 'config.toml' || entry === 'mcp.json') continue
    await symlink(join(real, entry), join(home, entry)).catch(() => {})
  }
  await writeFile(join(home, 'config.toml'), raised, { mode: 0o600 })
  return home
}

const writeMcpConfig = async (run: HarnessRun, context: HarnessContext) => {
  await mkdir(run.projectDir, { recursive: true })
  const config = JSON.stringify(
    {
      mcpServers: {
        studio: {
          command: 'node',
          args: [context.mcpShimPath],
          env: { STUDIO_MCP_URL: studioMcpUrl(context.origin, run.inputs) },
          toolTimeoutMs: 900_000
        }
      }
    },
    null,
    2
  )
  await writeFile(join(run.projectDir, '.mcp.json'), config)
  await mkdir(join(run.projectDir, '.kimi-code'), { recursive: true })
  await writeFile(join(run.projectDir, '.kimi-code', 'mcp.json'), config)
  return config
}

export const createKimiAdapter = (context: HarnessContext): HarnessAdapter => ({
  id: 'kimi',
  // Not yet shown to read image files in a run.
  images: 'unverified',
  available: () => probeVersion('kimi'),
  models: kimiModels,
  async run(run, onEvent, signal) {
    const mcpConfig = await writeMcpConfig(run, context)
    // Skills discovery reads the project's installed copy when present
    // (--skills-dir names the directory that CONTAINS the skill folders).
    const installedRoot = join(run.projectDir, '.claude', 'skills')
    const skillsRoot = existsSync(join(installedRoot, run.skill))
      ? installedRoot
      : context.skillsDir
    const effort =
      typeof run.inputs.effort === 'string' && run.inputs.effort
        ? run.inputs.effort
        : 'high'
    const home = effort
      ? await homeWithEffort(run.projectDir, effort).catch((error) => {
          if (run.skill === 'explainer-master') throw error
          onEvent({
            type: 'text',
            ts: Date.now(),
            text: `thinking effort left as configured (${error instanceof Error ? error.message : error})`
          })
          return ''
        })
      : ''
    // This is an app-created isolated home, not the user's configuration.
    // Register the app's tools here as well so prompt mode does not discard
    // project MCP servers while waiting for interactive workspace trust.
    if (home)
      await writeFile(join(home, 'mcp.json'), mcpConfig, { mode: 0o600 })
    return runAcp({
      command: 'kimi',
      args: ['--skills-dir', skillsRoot, 'acp'],
      cwd: run.projectDir,
      env: {
        SKILL_DIR: resolveSkillDir(
          context.skillsDir,
          run.projectDir,
          run.skill
        ),
        ...(home ? { KIMI_CODE_HOME: home } : {})
      },
      model:
        typeof run.inputs.model === 'string' ? run.inputs.model : undefined,
      resumeId: run.resumeId,
      task: String(run.inputs.task || ''),
      onEvent,
      signal
    })
  }
})
