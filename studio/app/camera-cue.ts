import type { Moment } from '../shared/model'
const labels = {
  full: 'On camera',
  start: 'On camera at the start',
  end: 'On camera at the end',
  both: 'On camera at the start and end',
  none: ''
}
export const cameraCue = (camera: Moment['camera']) =>
  camera === 'none'
    ? ''
    : `<span class="camera-cue" role="img" aria-label="${labels[camera]}" title="${labels[camera]}"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="4" width="8.5" height="8" rx="1.4"/><path d="m10 6 4.5-2v8L10 10"/></svg></span>`

export const microphoneCue = `<span class="camera-cue" role="img" aria-label="Voice recording needed" title="Voice recording needed"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><rect x="5.5" y="1.5" width="5" height="8" rx="2.5"/><path d="M3.5 7.5v.5a4.5 4.5 0 0 0 9 0v-.5M8 12.5v2M5.5 14.5h5"/></svg></span>`

/** Where the creator's take goes until there is one, on the storyboard and
 * a scene's page alike: a neutral outline, never a stranger's face (review
 * 7: the scene page showed a stock photo). */
export const takePlaceholder = (more = '') =>
  `<div class="take-placeholder"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="36" r="19"/><path d="M24 108v-15a36 36 0 0 1 72 0v15"/></svg><small>${cameraCue('full')}Your take goes here</small>${more}</div>`
