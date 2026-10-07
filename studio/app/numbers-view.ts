// What the numbers say, in the release dialog: the video's views and watch
// time, retention drawn against the beats, each post's reach, and what it
// suggests for the next episode.
import type { Snapshot } from '../shared/api'
import {
  biggestDrop,
  latest,
  numberLessons,
  retentionByBeat
} from '../shared/numbers'
import { escape } from './ui'

const count = (n?: number) => (n === undefined ? '–' : n.toLocaleString())

export const numbersSection = (snapshot: Snapshot) => {
  const release = snapshot.project.release
  const youtube = latest(release?.numbers, 'youtube')
  const beats = youtube?.retention
    ? retentionByBeat(snapshot.project, youtube.retention)
    : []
  const drop = biggestDrop(beats)
  const lessons = numberLessons(beats)
  const posts = [
    latest(release?.numbers, 'x'),
    latest(release?.numbers, 'hand')
  ]
    .filter((item) => item !== null)
    .flatMap((item) => Object.entries(item!.posts || {}))
  const videoId = release?.youtube?.videoId
  return `<section class="release-section numbers"><h3>Numbers ${youtube ? `<small>read ${escape(new Date(youtube.at).toLocaleDateString())}</small>` : ''}</h3>
<form id="youtube-video-form" class="numbers-video"><label for="youtube-video">YouTube link</label><input id="youtube-video" name="video" value="${videoId ? `https://youtu.be/${escape(videoId)}` : ''}" placeholder="Paste it once the video is up" autocomplete="off"><button class="quiet">Keep</button></form>
${
  youtube
    ? `<p class="numbers-totals">${count(youtube.views)} views · ${count(Math.round(youtube.watchMinutes || 0))} minutes watched</p>`
    : ''
}
${
  beats.length
    ? `<ol class="retention">${beats
        .map(
          (beat) =>
            `<li><span>${escape(beat.title)}</span><i style="--from:${Math.round(beat.from * 100)}%;--to:${Math.round(beat.to * 100)}%"></i><small>${Math.round(beat.from * 100)} → ${Math.round(beat.to * 100)}</small></li>`
        )
        .join('')}</ol>`
    : ''
}
${drop ? `<p class="numbers-drop">${escape(drop)}</p>` : ''}
${lessons.length ? `<ul class="numbers-lessons">${lessons.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>` : ''}
${
  posts.length
    ? `<ul class="numbers-posts">${posts
        .map(
          ([item, numbers]) =>
            `<li>${escape(item === 'linkedin' ? 'LinkedIn' : (release?.campaign.find((entry) => entry.id === item)?.words.slice(0, 40) ?? item))}: ${count(numbers.impressions)} seen · ${count(numbers.likes)} likes</li>`
        )
        .join('')}</ul>`
    : ''
}
<div class="numbers-actions"><button type="button" class="quiet" data-action="read-numbers">Read the numbers</button><button type="button" class="quiet" data-action="accounts">Accounts</button></div>
<details class="numbers-hand"><summary>Enter LinkedIn’s numbers</summary><form id="hand-numbers" class="hand-numbers">
<label>Seen<input name="impressions" type="number" min="0"></label><label>Likes<input name="likes" type="number" min="0"></label><label>Reposts<input name="reposts" type="number" min="0"></label><label>Comments<input name="replies" type="number" min="0"></label>
<button class="quiet">Keep</button></form></details></section>`
}
