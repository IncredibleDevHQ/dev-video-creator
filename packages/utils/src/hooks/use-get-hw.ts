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

const useGetHW = ({
	maxH,
	maxW,
	aspectRatio,
}: {
	maxH: number
	maxW: number
	aspectRatio: number
}) => {
	let calWidth = 0
	let calHeight = 0
	if (aspectRatio > maxW / maxH) {
		calHeight = maxW * (1 / aspectRatio)
		calWidth = maxW
	} else if (aspectRatio <= maxW / maxH) {
		calHeight = maxH
		calWidth = maxH * aspectRatio
	}
	return { width: calWidth, height: calHeight }
}

export default useGetHW
