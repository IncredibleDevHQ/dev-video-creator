export const codeJamConfig = [
  {
    key: 'allowRaiseHand',
    type: 'checkbox', // lowercase
    name: 'Raise Hands',
    description: 'Allow participants to raise hands?',
    value: true,
    dirty: false,
    required: true,
    default: true,
    editable: true,
  },
  {
    key: 'gistUrl',
    type: 'TextField',
    name: 'Gist URL',
    description: 'The Gist URL for this code!',
    dirty: false,
    value: 'esedddddea',
    required: false,
    default: 'blah',
    editable: true,
  },
]

export const videoJamConfig = [
  {
    key: 'allowRaiseHand',
    type: 'Checkbox',
    name: 'Raise Hands',
    description: 'Allow participants to raise hands?',
    value: false,
    dirty: false,
    required: true,
    default: 'boolean',
    editable: true,
  },
  {
    key: 'source',
    type: 'TextField',
    name: 'Video url',
    description: 'The Video URL for this Video Jam!',
    dirty: false,
    required: true,
    default: 'text',
    editable: true,
  },
]
