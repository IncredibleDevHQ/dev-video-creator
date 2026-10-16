// Where a notebook stands, in the words Home uses for it: on its tile and in
// its series' row alike (review 6 audit: the rows said "draft").
import type { NotebookSummary } from '../shared/api'

export const notebookState = (item: NotebookSummary) =>
  item.status === 'reading'
    ? 'Reading the source'
    : item.status === 'draft'
      ? 'Ready to create wireframes'
      : item.status === 'failed'
        ? 'Needs another try'
        : item.status === 'building'
          ? 'Wireframes in progress'
          : item.videoReady
            ? 'Video ready'
            : item.hasVideo
              ? 'Video in progress'
              : 'Wireframes ready'
