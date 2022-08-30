// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.



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
