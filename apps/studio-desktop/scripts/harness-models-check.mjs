// Harness model lists — pure checks on how the planning workspace learns
// which models each local harness can run: Claude's list gated by the CLI
// version, Kimi's and Codex's read from their own config files (names only).
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const dir = await mkdtemp(join(tmpdir(), 'harness-models-check-'))
const load = async name => {
  const outfile = join(dir, `${name}.mjs`)
  await build({ entryPoints: [join(appDir, `src/harness/${name}.ts`)], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' })
  return import(pathToFileURL(outfile).href)
}
const models = await load('models')
const errors = await load('provider-errors')
const operations = await load('operations')

const failures = []
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`)
  if (!ok) failures.push(message)
}

check(models.compareVersions('2.1.280 (Claude Code)', '2.1.278') > 0 && models.compareVersions('2.1.278', '2.1.280') < 0 && models.compareVersions('2.1.280', '2.1.280') === 0, 'CLI versions compare part by part')

const old = models.claudeModels('2.1.278 (Claude Code)')
const opusOnOld = old.options.find(option => option.id === 'claude-opus-5-5')
check(/needs Claude Code 2\.1\.280 or newer \(found 2\.1\.278/.test(opusOnOld?.unavailable || ''), 'Opus 5.5 is marked unavailable on a CLI older than 2.1.280, with the version it needs')
check(!models.claudeModels('2.1.280 (Claude Code)').options.find(option => option.id === 'claude-opus-5-5')?.unavailable, 'Opus 5.5 is offered on Claude Code 2.1.280')
check(models.claudeModels('STUDIO_CLAUDE_BIN').options.every(option => !option.unavailable), 'a CLI of unknown version is not gated')
check(old.default === null && old.options.some(option => option.id === 'claude-fable-5-1'), 'Claude lists its current models and leaves the CLI default unnamed')

const kimi = models.kimiModelsFrom([
  'default_model = "kimi-code/k3"',
  '',
  '[models."kimi-code/kimi-for-coding"]',
  'provider = "kimi"',
  '[models."kimi-code/k3"]',
  '[models."kimi-code/k3-256k"]',
  '[providers.kimi]',
  'api_key = "must-not-appear"',
].join('\n'))
check(kimi.default === 'kimi-code/k3', 'Kimi\'s default model is its config\'s default_model')
check(JSON.stringify(kimi.options.map(option => option.id)) === JSON.stringify(['kimi-code/k3', 'kimi-code/kimi-for-coding', 'kimi-code/k3-256k']), `Kimi lists its configured models once each, default first (${kimi.options.map(option => option.id)})`)
check(!JSON.stringify(kimi).includes('must-not-appear'), 'only model names are read from the Kimi config')

const codex = models.codexModelsFrom(['model = "gpt-5.6-luna"', '', '[profiles.fast]', 'model = "some-other-model"'].join('\n'))
check(codex.options.length === 1 && codex.options[0].id === 'gpt-5.6-luna', 'Codex offers the model its config names at the top level, not a profile\'s')
check(models.codexModelsFrom('').options.length === 0, 'a Codex config without a model offers only the CLI default')

// Failures a creator can act on, from providers' real public messages.
const kinds = [
  ['Run `kimi` here and choose "Trust this folder" to enable them. · error: failed to run prompt: provider.auth_error: 403 You\'ve reached your weekly (7-day) usage limit.', 'quota'],
  ["You're out of usage credits. Switch to a different model or manage credits.", 'quota'],
  ['API Error: 400 Claude Code 2.1.278 does not support this model; version 2.1.280 or newer is required.', 'model'],
  ['Claude Code is not logged in for the command line. Open a terminal, run `claude`, then `/login` once', 'auth'],
  ['API Error: 429 Too Many Requests', 'rate-limit'],
  ['request to https://api.example failed, reason: getaddrinfo ENOTFOUND api.example', 'network'],
  ['spawn codex ENOENT', 'unavailable'],
  ['The model produced an empty page', 'other'],
]
for (const [message, expected] of kinds) check(errors.categorise(message) === expected, `"${message.slice(0, 48)}…" reads as ${expected} (${errors.categorise(message)})`)
const quota = errors.describeFailure({ message: kinds[0][0], harness: 'kimi', requestedModel: 'kimi-code/k3' })
check(quota.recovery[0] === 'Retry after restoring Kimi credits' && quota.recovery.includes('Switch harness or model') && quota.requestedModel === 'kimi-code/k3', 'a quota failure offers restoring credits or switching, never an automatic retry')
check(errors.describeFailure({ message: '', harness: 'claude-code', category: 'interrupted' }).recovery.join() === 'Retry', 'an interrupted run offers a retry')

// Reading a manual is not writing a page.
const ops = [['Read', 'read'], ['Glob', 'search'], ['Grep', 'search'], ['Write', 'write'], ['Edit', 'edit'], ['MultiEdit', 'edit'], ['Bash', 'run'], ['ReadFile', 'read'], ['WriteFile', 'write'], ['StrReplaceFile', 'edit'], ['mcp__studio__plan_submit_brief', 'tool'], ['SomethingNew', 'tool']]
for (const [tool, expected] of ops) check(operations.operationOf(tool) === expected, `${tool} is ${expected} (${operations.operationOf(tool)})`)

await rm(dir, { recursive: true, force: true })
console.log(failures.length ? `HARNESS MODELS CHECK FAIL (${failures.length})` : 'HARNESS MODELS CHECK PASS')
process.exit(failures.length ? 1 : 0)
