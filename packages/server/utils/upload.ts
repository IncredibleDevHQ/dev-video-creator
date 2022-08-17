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

import mime from 'mime'
import serverEnvs from './env'

const allowedExtensions = serverEnvs.ALLOWED_EXT?.split(',') || []

const isKeyAllowed = async (key: string) => {
	const ext = key.split('.').pop()?.trim()
	if (!ext) return { ext: null, valid: false }

	return {
		ext: ext.toString(),
		mime: mime.getType(ext)?.toString(),
		valid: allowedExtensions.includes(ext),
	}
}

// eslint-disable-next-line import/prefer-default-export
export { isKeyAllowed }
