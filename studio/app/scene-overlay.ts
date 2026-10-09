import type { Snapshot } from '../shared/api'
import type { Moment } from '../shared/model'
import { escape } from './ui'

/** A moment's overlay on the stage: the title card, the end card or a name. */
export const sceneOverlay = (project: Snapshot['project'], moment?: Moment) =>
  moment?.overlay &&
  !(moment.overlay === 'title-card' && moment.camera === 'none')
    ? `<div class="scene-overlay ${moment.overlay}">${
        moment.overlay === 'title-card'
          ? escape(project.title)
          : moment.overlay === 'end-card'
            ? 'Thanks for watching'
            : escape(project.branding?.name || 'Your name')
      }</div>${
        moment.overlay === 'title-card' && project.branding?.name
          ? `<div class="preview-name">${escape(project.branding.name)}</div>`
          : ''
      }`
    : ''
