// D5 take-alignment check: align_take.py maps beats onto the take's actual
// transcript in order — a paraphrase or a skipped beat is flagged for review,
// never silently invented; repeated words keep occurrence identity. Runs the
// real script with a canned transcript (no model download needed).
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const script = fileURLToPath(new URL('../skills/explainer-master/scripts/align_take.py', import.meta.url))
const dir = await mkdtemp(join(tmpdir(), 'align-take-'))

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

// The take: the speaker's actual words, in time.
const TRANSCRIPT = [
  'when', 'the', 'service', 'comes', 'back,', 'everyone', 'retries', 'together.',
  'each', 'client', 'then', 'waits', 'a', 'different', 'interval,', 'and', 'retries', 'land', 'spread', 'out.',
].map((word, index) => ({ word, startMs: index * 500, endMs: index * 500 + 420 }))

try {
  // Exact delivery: both beats fully heard.
  const exact = join(dir, 'exact.json')
  await writeFile(exact, JSON.stringify({
    audio: 'unused.mp3',
    transcript: TRANSCRIPT,
    beats: [
      { id: 'b1', say: 'When the service comes back, everyone retries together.' },
      { id: 'b2', say: 'Each client then waits a different interval, and retries land spread out.' },
    ],
  }))
  await run('python3', [script, exact])
  const exactOut = JSON.parse(await readFile(exact.replace(/\.json$/, '.take-aligned.json'), 'utf8'))
  check('a faithful take aligns every beat in full', exactOut.beats.every(b => b.coverage === 1 && !b.review))
  check('beat 2 starts where the speaker actually started it', exactOut.beats[1].startMs === 4000, `startMs=${exactOut.beats[1].startMs}`)
  check('repeated "retries" keep occurrence identity', exactOut.beats[1].words.find(w => w.word === 'retries')?.startMs === 8000)

  // Paraphrase in the middle: 'waits a different interval' became 'holds back a while'.
  const paraphrased = TRANSCRIPT.map(w => ({ ...w }))
  paraphrased.splice(11, 5, ...['holds', 'back', 'a', 'while,', 'and'].map((word, i) => ({ word, startMs: 5500 + i * 500, endMs: 5900 + i * 500 })))
  const paraphrase = join(dir, 'paraphrase.json')
  await writeFile(paraphrase, JSON.stringify({
    audio: 'unused.mp3',
    transcript: paraphrased,
    beats: [
      { id: 'b1', say: 'When the service comes back, everyone retries together.' },
      { id: 'b2', say: 'Each client then waits a different interval, and retries land spread out.' },
    ],
  }))
  await run('python3', [script, paraphrase])
  const paraOut = JSON.parse(await readFile(paraphrase.replace(/\.json$/, '.take-aligned.json'), 'utf8'))
  check('a paraphrased passage is flagged, not invented', Boolean(paraOut.beats[1].review) && paraOut.beats[1].coverage < 1, paraOut.beats[1].review || '')
  check('the faithful beat still aligns in full', paraOut.beats[0].coverage === 1 && !paraOut.beats[0].review)
  check('alignment continues after the paraphrase', paraOut.beats[1].words.some(w => w.word === 'spread'))

  // A skipped beat: the take jumps straight to the second point.
  const skipped = join(dir, 'skipped.json')
  await writeFile(skipped, JSON.stringify({
    audio: 'unused.mp3',
    transcript: TRANSCRIPT.slice(8),
    beats: [
      { id: 'b1', say: 'When the service comes back, everyone retries together.' },
      { id: 'b2', say: 'Each client then waits a different interval, and retries land spread out.' },
    ],
  }))
  await run('python3', [script, skipped])
  const skipOut = JSON.parse(await readFile(skipped.replace(/\.json$/, '.take-aligned.json'), 'utf8'))
  check('a beat the take skips is named for review', Boolean(skipOut.beats[0].review) && skipOut.beats[0].coverage < 0.5, `coverage=${skipOut.beats[0].coverage} review=${skipOut.beats[0].review || ''}`)
  check('the following beat is unaffected', skipOut.beats[1].coverage === 1)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `ALIGN TAKE CHECK FAIL (${failures})` : 'ALIGN TAKE CHECK PASS')
process.exitCode = failures ? 1 : 0
