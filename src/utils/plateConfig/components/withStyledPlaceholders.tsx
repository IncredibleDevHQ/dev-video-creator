import {
  ELEMENT_H1,
  ELEMENT_MEDIA_EMBED,
  ELEMENT_PARAGRAPH,
  withPlaceholders,
} from '@udecode/plate'

export const withStyledPlaceHolders = (components: any) =>
  withPlaceholders(components, [
    {
      key: ELEMENT_PARAGRAPH,
      placeholder: 'Type a paragraph',
      hideOnBlur: true,
    },
    {
      key: ELEMENT_H1,
      placeholder: 'Untitled',
      hideOnBlur: false,
    },
    // {
    //   key: ELEMENT_MEDIA_EMBED,
    //   placeholder: 'Paste a link to a video or image',
    //   'aria-disabled': true,
    //   'aria-readonly': true,
    // },
  ])
