// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

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
