import type { Moment, Presence } from '../shared/model'
import { presenceProblems } from './planning/presence'
import { comparableText, fingerprintOf } from './planning/fingerprint'
import { recordingKeyOf } from './scene-model'
export const momentPlanSchema = { type: 'object', additionalProperties: false, required: ['moments'], properties: { moments: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title','lines','seconds','camera','layout','overlay','cue','segments'], properties: {
  id: { type: 'string' },
  segments: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['lines','camera','seconds'], properties: { lines: { type: 'string' }, camera: { type: 'boolean' }, seconds: { type: 'number' } } } },
  title: { type: 'string' }, lines: { type: 'string' }, cue: { type: 'string' }, seconds: { type: 'number' },
  camera: { type: 'string', enum: ['none','full','start','end','both'] }, layout: { type: 'string', enum: ['full-screen','corner','beside-slide'] }, overlay: { type: ['string','null'], enum: ['title-card','lower-third','end-card',null] },
} } } } }
export const normalizeMoments = (raw: unknown, sceneId: string, presence: Presence, role: string, previous: Moment[] = []): Moment[] => {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).moments)) throw new Error('The scene has no moments')
  const entries = (raw as { moments: Record<string, unknown>[] }).moments
  if (!entries.length || entries.length > 16) throw new Error('A scene needs 1–16 moments')
  let clock = 0
  const used = new Set<string>()
  const moments = entries.map((entry,index): Moment => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid moment')
    const lines = String(entry.lines || '').trim(); const seconds = Number(entry.seconds)
    if (!lines || lines.length > 5000 || !Number.isFinite(seconds) || seconds < 2 || seconds > 90) throw new Error('Each moment needs words and a length between 2 and 90 seconds')
    if (!['none','full','start','end','both'].includes(String(entry.camera)) || !['full-screen','corner','beside-slide'].includes(String(entry.layout))) throw new Error('Invalid camera staging')
    if (entry.overlay !== null && !['title-card','lower-third','end-card'].includes(String(entry.overlay))) throw new Error('Invalid overlay')
    // Submitted semantic IDs survive reordering. For older/no-ID candidates,
    // recover the prior identity by its spoken content, rather than its index.
    const retainedId = previous.find(old => !used.has(old.id) && comparableText(old.lines) === comparableText(lines))?.id
    const submittedId = entry.id
    if (submittedId !== undefined && (typeof submittedId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(submittedId))) throw new Error('Invalid moment identity')
    const baseId = retainedId || `${sceneId}-moment-${fingerprintOf({title:entry.title,lines})}`
    let id = typeof submittedId === 'string' ? submittedId : baseId
    if (submittedId === undefined) {let suffix=1;while(used.has(id)) id=`${baseId}-${++suffix}`}
    if (used.has(id)) throw new Error('Moment identities must be unique')
    used.add(id)
    const moment: Moment = { id, title: String(entry.title || `Moment ${index+1}`).slice(0,120), cue: String(entry.cue || '').slice(0,500), plannedSeconds: seconds, lines, start: clock, end: Math.round((clock+seconds)*100)/100, camera: entry.camera as Moment['camera'], layout: entry.layout as Moment['layout'], overlay: entry.overlay as Moment['overlay'], recordingKey: '', take: null, audio: null, audioKey: '' }
    const entries = entry.segments
    if (Array.isArray(entries) && entries.length && entries.length <= 12) {
      moment.segments = entries.map((segment,index) => {
        if (!segment || typeof segment !== 'object' || typeof segment.lines !== 'string' || !segment.lines.trim() || typeof segment.camera !== 'boolean' || !Number.isFinite(segment.seconds) || segment.seconds <= 0) throw new Error('Invalid spoken segment')
        return { id: `${moment.id}-segment-${index+1}`, lines: segment.lines.trim(), camera: segment.camera, estimate: Number(segment.seconds) }
      })
      if (comparableText(moment.segments.map(segment => segment.lines).join(' ')) !== comparableText(lines)) throw new Error('Spoken segments must contain the exact moment lines in order')
      if (Math.abs(moment.segments.reduce((sum,segment) => sum+segment.estimate,0)-seconds) > 0.2) throw new Error('Segment lengths must add up to the moment length')
      const shown = moment.segments.map(segment => segment.camera)
      const first = shown.findIndex(Boolean); const last = shown.lastIndexOf(true)
      const valid = moment.camera === 'none' ? shown.every(value => !value) : moment.camera === 'full' ? shown.every(Boolean) : moment.camera === 'start' ? first === 0 && last < shown.length-1 && shown.slice(0,last+1).every(Boolean) : moment.camera === 'end' ? first > 0 && last === shown.length-1 && shown.slice(first).every(Boolean) : shown[0] && shown.at(-1) && shown.some(value => !value) && shown.slice(shown.indexOf(false),shown.lastIndexOf(false)+1).every(value => !value)
      if (!valid) throw new Error('Spoken segments do not match the camera window')
    } else {
      if (!['none','full'].includes(moment.camera)) throw new Error('Start, end and both camera windows need spoken segments')
      moment.segments = [{ id: `${moment.id}-segment-1`, lines, camera: moment.camera === 'full', estimate: seconds }]
    }
    clock = moment.end; moment.recordingKey = recordingKeyOf(moment)
    const unchanged=previous.find(old=>old.id===moment.id && old.recordingKey===moment.recordingKey)
    if(unchanged?.extension){moment.extension=structuredClone(unchanged.extension);moment.segments=structuredClone(unchanged.segments)}
    moment.take = previous.find(old => old.id === moment.id && old.recordingKey === moment.recordingKey)?.take || null
    return moment
  })
  const problems = presenceProblems(moments.map(moment => ({ id: moment.id, presenter: { visibility: moment.camera === 'none' ? 'hidden' : moment.layout === 'full-screen' ? 'full' : 'shared' } })), presence)
  if (presence === 'high' && !['full','start','both'].includes(moments[0].camera)) problems.push('High opens with the presenter at the start of the first moment')
  if (presence !== 'off' && !['full','end','both'].includes(moments.at(-1)!.camera)) problems.push('The presenter closes the last moment')
  if (role === 'title') {
    if (moments[0].overlay !== 'title-card') problems.push('The opening moment needs the video title card')
    if (presence === 'high' && (moments[0].camera !== 'full' || moments[0].layout !== 'full-screen')) problems.push('The title scene opens with the presenter full screen')
  }
  const last = moments.at(-1)!
  if (role === 'ending' && presence !== 'off' && (last.camera !== 'full' || last.layout !== 'full-screen' || last.overlay !== 'end-card')) problems.push('The ending scene closes with the presenter full screen and an end card')
  if (problems.length) throw new Error(problems.join('; '))
  return moments
}
