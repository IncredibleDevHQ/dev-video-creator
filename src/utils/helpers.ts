import * as ebml from 'ts-ebml'
import { Buffer } from 'buffer'
import { emitToast } from '../components'

/** @ts-ignore */
window.Buffer = Buffer

export function getSeekableWebM(arrayBuffer: ArrayBuffer) {
  if (typeof ebml === 'undefined') {
    throw new Error('Please link: https://www.webrtc- experiment.com/EBML.js')
  }

  const [decoder, encoder, reader, tools] = [
    new ebml.Decoder(),
    new ebml.Encoder(),
    new ebml.Reader(),
    ebml.tools,
  ]
  let elms = decoder.decode(arrayBuffer)
  const validEmlType = ['m', 'u', 'i', 'f', 's', '8', 'b', 'd'] // This is from elm type of the lib
  elms = elms?.filter((elm) => validEmlType.includes(elm.type))
  elms.forEach((elm) => {
    reader.read(elm)
  })

  const refinedMetadataBuf = tools.makeMetadataSeekable(
    reader.metadatas,
    reader.duration,
    reader.cues
  )
  const body = arrayBuffer.slice(reader.metadataSize)
  const refinedWebM = new Blob([refinedMetadataBuf, body], {
    type: 'video/webm',
  })
  console.log({ refinedWebM })
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
