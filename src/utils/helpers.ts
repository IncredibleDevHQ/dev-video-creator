import * as ebml from 'ts-ebml'
import { Buffer } from 'buffer'
import { emitToast } from '../components'

/** @ts-ignore */
window.Buffer = Buffer

export function getSeekableWebM(arrayBuffer: ArrayBuffer) {
  const [decoder, encoder, reader, tools] = [
    new ebml.Decoder(),
    new ebml.Encoder(),
    new ebml.Reader(),
    ebml.tools,
  ]
  const elms = decoder.decode(arrayBuffer)
  elms.forEach((elm) => {
    reader.read(elm)
  })
  const refinedMetadataBuf = tools.makeMetadataSeekable(
    reader.metadatas,
    reader.duration,
    reader.cues
  )
  const body = arrayBuffer.slice(reader.metadataSize)
  const refinedWebM = new Blob([refinedMetadataBuf, body])
  return refinedWebM
}

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err: any) {
    emitToast({
      title: 'Failed to copy text',
      type: 'error',
      description: err?.message,
    })
  }
}
