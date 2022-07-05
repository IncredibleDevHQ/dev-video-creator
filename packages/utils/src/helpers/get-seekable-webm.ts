import * as ebml from 'ts-ebml'
// import { Buffer } from 'buffer'

// /** @ts-ignore */
// window.buffer = Buffer

function getSeekableWebM(arrayBuffer: ArrayBuffer) {
	if (typeof ebml === 'undefined') {
		throw new Error('Please link: https://www.webrtc- experiment.com/EBML.js')
	}

	const [decoder, , reader, tools] = [
		new ebml.Decoder(),
		new ebml.Encoder(),
		new ebml.Reader(),
		ebml.tools,
	]
	let elms = decoder.decode(arrayBuffer)
	const validEmlType = ['m', 'u', 'i', 'f', 's', '8', 'b', 'd'] // This is from elm type of the lib
	elms = elms?.filter(elm => validEmlType.includes(elm.type))
	elms.forEach(elm => {
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

	return refinedWebM
}

export default getSeekableWebM
