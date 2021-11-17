import config from '../../../config'

export const initEditor = [
  {
    children: [{ text: 'Welcome to your new fragment!! ' }],
    type: 'h1',
    id: 1636438465313,
  },
  { type: 'p', children: [{ text: '' }], id: 1636438471442 },
  {
    type: 'h1',
    id: 1636438471826,
    children: [{ text: '💻  Explain some code ? ' }],
  },
  {
    type: 'code_block',
    children: [
      {
        type: 'code_line',
        children: [{ text: '// Type some code here!' }],
        id: 1636379826800,
      },
      { type: 'code_line', children: [{ text: '' }], id: 1636437487278 },
      {
        type: 'code_line',
        children: [{ text: 'function dropRight(array, n=1) {' }],
        id: 1636437471305,
      },
      {
        type: 'code_line',
        id: 1636437471844,
        children: [
          { text: '  const length = array == null ? 0 : array.length' },
        ],
      },
      {
        type: 'code_line',
        id: 1636437471849,
        children: [{ text: '  n = length - toInteger(n)' }],
      },
      {
        type: 'code_line',
        id: 1636437471852,
        children: [
          { text: '  return length ? slice(array, 0, n < 0 ? 0 : n) : []' },
        ],
      },
      { type: 'code_line', id: 1636437471855, children: [{ text: '}' }] },
    ],
    id: 1636379826808,
    lang: 'javascript',
  },
  {
    type: 'h1',
    id: 1636379834110,
    children: [{ text: '✴️ Talk over important points' }],
  },
  {
    type: 'p',
    id: 1636437501878,
    children: [
      { text: 'Or create a series of important points you wish to discuss:' },
    ],
  },
  {
    type: 'ul',
    children: [
      {
        type: 'li',
        children: [
          { type: 'lic', id: 1636379847936, children: [{ text: 'Eat ' }] },
        ],
        id: 1636379849054,
      },
      {
        type: 'li',
        children: [
          { type: 'lic', children: [{ text: 'Sleep' }], id: 1636379851401 },
        ],
        id: 1636379851401,
      },
      {
        type: 'li',
        children: [
          {
            type: 'lic',
            children: [{ text: 'Create Content' }],
            id: 1636379853372,
          },
        ],
        id: 1636379853371,
      },
      {
        type: 'li',
        children: [
          { type: 'lic', children: [{ text: 'Repeat' }], id: 1636379856390 },
        ],
        id: 1636379856390,
      },
    ],
    id: 1636379849046,
  },
  {
    type: 'h1',
    children: [{ text: '❓Answer Questions ' }],
    id: 1636379858945,
  },
  {
    type: 'p',
    id: 1636379859973,
    children: [
      {
        text: 'Create some engaging conversations about questions or image from your community?',
      },
    ],
  },
  {
    type: 'blockquote',
    id: 1636379890271,
    children: [{ text: 'Question1' }],
  },
  {
    type: 'blockquote',
    children: [{ text: 'Another Question ?!' }],
    id: 1636437648021,
  },
  {
    type: 'p',
    id: 1636437645944,
    children: [
      {
        text: 'You can add in any text here :) All non markdown formated text gets added as notes which you can refer to while recording!',
      },
    ],
  },
  {
    type: 'h1',
    id: 1636437630339,
    children: [{ text: '🖼️  Talk Over Images' }],
  },
  {
    type: 'img',
    url: `${config.storage.baseUrl}idev-logo.svg`,
    children: [{ text: '' }],
    id: 1636379944898,
    width: 280,
    caption: [{ text: 'Interesting Image 1' }],
  },
  {
    type: 'h1',
    children: [{ text: '⏯️  Walkthrough Videos ' }],
    id: 1636379944900,
  },
  {
    type: 'media_embed',
    url: `${config.storage.baseUrl}video-jam-template.mp4`,
    children: [{ text: '' }],
    id: 1636438386684,
  },
  { type: 'p', id: 1636379966739, children: [{ text: '' }] },
]
