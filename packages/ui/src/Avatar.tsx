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

/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { cx } from '@emotion/css'
import axios from 'axios'
import { HTMLProps } from 'react'

export const isImageLoaded = async (src: string) => {
	try {
		const { status } = await axios.get(src)
		if (status === 200) return true
		return false
	} catch (e) {
		return false
	}
}

export const Avatar = ({
	className,
	alt,
	src,
	name,
	onClick,
}: { name: string } & HTMLProps<HTMLImageElement>) => {
	if (src && src?.includes('cdn')) {
		return (
			<img className={cx(className)} src={src} alt={alt} onClick={onClick} />
		)
	}

	return (
		<img
			className={cx(className)}
			src={`https://ui-avatars.com/api/?name=${name}`}
			alt={alt}
			onClick={onClick}
		/>
	)
}
