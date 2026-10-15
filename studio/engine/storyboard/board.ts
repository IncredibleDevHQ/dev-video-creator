// The board: every frame's still on one page, the way Hyperframes reviews a
// storyboard from v0.8.158 (hyperframes-creative's storyboard recipe § 2): a
// `.frame` per still in film order, with its title, its time and its words,
// and an `.act` heading before each scene. Hyperframes' tools, its desktop
// app among them, find the frames by these classes. The page is written
// before the stills land, and each still shows by itself once it does.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BUILD_LABELS, frameId } from '../../shared/storyboard'
import type { Internal } from './state'

const escape = (value: string) =>
  value.replace(
    /[&<>"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!
  )

export const BOARD_FILE = join('boards', 'storyboard.html')
export const stillFile = (id: string) => join('boards', 'stills', `${id}.png`)
export const poseFile = (id: string) => join('boards', 'poses', `${id}.html`)

const STYLE = `
:root { --page: #eef0f2; --card: #fff; --ink: #16191d; --muted: #5d6670; --line: #d9dde2; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
header, main { max-width: 1320px; margin: 0 auto; padding: 0 24px; }
header { padding-top: 40px; }
header h1 { margin: 0 0 6px; font-size: 26px; line-height: 1.25; letter-spacing: -0.015em; text-wrap: balance; }
header p { margin: 0; color: var(--muted); max-width: 70ch; }
main { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; padding-top: 24px; padding-bottom: 64px; }
.act { grid-column: 1 / -1; margin-top: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--line); font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.frame { display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.frame img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #23272d; }
.frame .title { padding: 12px 14px 0; font-weight: 600; }
.frame .time { padding: 0 14px; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.frame .words { margin: 8px 14px 14px; font-size: 14px; }
@media (max-width: 420px) { header, main { padding-left: 16px; padding-right: 16px; } main { grid-template-columns: 1fr; } }
`

/** The board's page: the plan's frames in order, each with its still. */
export const boardPage = (
  internal: Internal,
  titles: Record<string, string>
) => {
  const plan = internal.plan!
  let at = 0
  const items = plan.scenes.flatMap((scene, index) => [
    `<section class="act">Scene ${index + 1}: ${escape(titles[scene.pageId] || BUILD_LABELS[scene.build])}</section>`,
    ...scene.frames.map((frame) => {
      const from = at
      at += internal.durations?.[frame.number] ?? frame.duration
      const id = frameId(frame)
      return [
        '<div class="frame">',
        `<img src="stills/${id}.png" alt="Frame ${frame.number}: ${escape(frame.scene)}" />`,
        `<div class="title">${String(frame.number).padStart(2, '0')}: ${escape(frame.title)}</div>`,
        `<div class="time">${from.toFixed(1)} to ${at.toFixed(1)}s</div>`,
        frame.voiceover
          ? `<p class="words">${escape(frame.voiceover)}</p>`
          : '',
        '</div>'
      ].join('')
    })
  ])
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Storyboard</title>
<style>${STYLE}</style>
</head>
<body>
<header><h1>${escape(plan.message)}</h1><p>For ${escape(plan.audience)} · ${plan.scenes.reduce((n, s) => n + s.frames.length, 0)} frames · ${Math.round(at)} s</p></header>
<main>
${items.join('\n')}
</main>
</body>
</html>
`
}

/** Writes boards/storyboard.html for the plan as it stands. */
export const writeBoard = async (
  dir: string,
  internal: Internal,
  titles: Record<string, string>
) => {
  if (!internal.plan) return
  await mkdir(join(dir, 'boards', 'stills'), { recursive: true })
  await writeFile(join(dir, BOARD_FILE), boardPage(internal, titles))
}
