import { describe, expect, it } from 'vitest'
import { sanitizeNotebookMedia, type TiptapDocument } from './index'

const documentWith = (nodes: TiptapDocument['content']): TiptapDocument => ({
  type: 'doc',
  content: nodes,
})

describe('sanitizeNotebookMedia', () => {
  it('resets media nodes whose source is a session-local blob URL', () => {
    const document = documentWith([
      {
        type: 'image',
        attrs: {
          id: 'image-1',
          uploadKey: 'upload-1',
          src: 'blob:http://127.0.0.1:4173/c83131ee-238e-4511-bd1f-852c7b1cc6a0',
          status: 'error',
          alt: 'Screenshot',
        },
      },
      {
        type: 'screenRecording',
        attrs: { id: 'screen-1', src: 'blob:null/abc', status: 'ready' },
      },
    ])
    expect(sanitizeNotebookMedia(document)).toBe(true)
    expect(document.content[0].attrs).toMatchObject({
      id: 'image-1',
      uploadKey: 'upload-1',
      src: '',
      status: 'error',
      alt: 'Screenshot',
    })
    expect(document.content[1].attrs).toMatchObject({
      id: 'screen-1',
      src: '',
      status: 'error',
    })
  })

  it('keeps uploaded and empty media sources untouched', () => {
    const document = documentWith([
      {
        type: 'image',
        attrs: {
          id: 'image-1',
          src: 'http://127.0.0.1:4319/objects/projects/p/image-1.png',
          status: 'ready',
        },
      },
      { type: 'image', attrs: { id: 'image-2', src: '', status: 'empty' } },
      {
        type: 'paragraph',
        attrs: { id: 'text-1' },
        content: [{ type: 'text', text: 'blob:http://not-an-attr' }],
      },
    ])
    const before = structuredClone(document)
    expect(sanitizeNotebookMedia(document)).toBe(false)
    expect(document).toEqual(before)
  })

  it('reaches media nodes nested inside container content', () => {
    const document = documentWith([
      {
        type: 'blockquote',
        attrs: { id: 'quote-1' },
        content: [
          {
            type: 'image',
            attrs: { id: 'image-1', src: 'blob:http://127.0.0.1:4173/dead', status: 'ready' },
          },
        ],
      },
    ])
    expect(sanitizeNotebookMedia(document)).toBe(true)
    expect(document.content[0].content?.[0].attrs).toMatchObject({
      src: '',
      status: 'error',
    })
  })
})
