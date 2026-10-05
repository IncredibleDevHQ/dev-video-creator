// Kimi ACP streams activity while the model is working, including before a
// complete tool call. Each run keeps its own configuration and workspace.
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { HarnessAdapter, HarnessContext, HarnessRun } from '../types'
import { runAcp } from './acp'
import { kimiRunHome, kimiSessionUsage, realKimiHome } from './kimi-home'
import { probeVersion, studioMcpUrl } from './util'
import { resolveSkillDir } from '../skills-install'
import { kimiModels } from '../models'

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
    const started = Date.now()
    const effort =
      typeof run.inputs.effort === 'string' && run.inputs.effort
        ? run.inputs.effort
        : 'high'
    const home = await kimiRunHome(run.projectDir, {
      effort,
      maxOutputTokens:
        typeof run.inputs.maxOutputTokens === 'number'
          ? run.inputs.maxOutputTokens
          : undefined,
      model: typeof run.inputs.model === 'string' ? run.inputs.model : undefined
    })
      .then((made) => {
        if (made.effort !== effort)
          onEvent({
            type: 'text',
            ts: Date.now(),
            text: `thinking effort ${made.effort} (the model has no ${effort})`
          })
        return made.home
      })
      .catch((error) => {
        if (run.skill === 'explainer-master') throw error
        onEvent({
          type: 'text',
          ts: Date.now(),
          text: `thinking effort left as configured (${error instanceof Error ? error.message : error})`
        })
        return ''
      })
    // This is an app-created isolated home, not the user's configuration.
    // Register the app's tools here as well so prompt mode does not discard
    // project MCP servers while waiting for interactive workspace trust.
    if (home)
      await writeFile(join(home, 'mcp.json'), mcpConfig, { mode: 0o600 })
    const result = await runAcp({
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
    const usage = result.resumeId
      ? await kimiSessionUsage({
          home: home || realKimiHome(),
          cwd: run.projectDir,
          sessionId: result.resumeId,
          since: started
        })
      : null
    return { ...result, ...(usage ? { usage } : {}) }
  }
})
