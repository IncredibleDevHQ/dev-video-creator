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

import { css, cx } from '@emotion/css'
import { motion } from 'framer-motion'
import Image from 'next/image'
import React from 'react'

export const rippleAnimation = css`
	&:hover {
		animation: at-ripple-pink 0.6s linear infinite;
	}
	@-webkit-keyframes at-ripple-pink {
		0% {
			box-shadow: 0 4px 10px rgba(21, 128, 61, 0.1),
				0 0 0 0 rgba(21, 128, 61, 0.1), 0 0 0 5px rgba(21, 128, 61, 0.1),
				0 0 0 10px rgba(21, 128, 61, 0.1);
		}
		100% {
			box-shadow: 0 4px 10px rgba(21, 128, 61, 0.1),
				0 0 0 5px rgba(21, 128, 61, 0.1), 0 0 0 10px rgba(21, 128, 61, 0.1),
				0 0 0 20px rgba(255, 65, 130, 0);
		}
	}
	@keyframes at-ripple-pink {
		0% {
			box-shadow: 0 4px 10px rgba(21, 128, 61, 0.1),
				0 0 0 0 rgba(21, 128, 61, 0.1), 0 0 0 5px rgba(21, 128, 61, 0.1),
				0 0 0 10px rgba(21, 128, 61, 0.1);
		}
		100% {
			box-shadow: 0 4px 10px rgba(21, 128, 61, 0.1),
				0 0 0 5px rgba(21, 128, 61, 0.1), 0 0 0 10px rgba(21, 128, 61, 0.1),
				0 0 0 20px rgba(255, 65, 130, 0);
		}
	}
`

const People = () => (
	<div className='w-full relative mt-4 h-2/3'>
		<motion.div
			className={cx(
				'w-14 h-14 rounded-full bg-dark-400 absolute top-[58.6%] left-[5%] lg:left-[30.95%]',
				rippleAnimation
			)}
			animate={{
				scale: [1, 1.2, 1],
			}}
			transition={{
				duration: 4,
				ease: 'easeInOut',
				times: [0, 0.4, 1, 1.6, 2],
				repeat: Infinity,
			}}
		>
			<Image
				src='/onboarding/person2.png'
				width={55}
				height={55}
				alt='person2'
			/>
		</motion.div>
		<motion.div
			className={cx(
				'w-20 h-20 rounded-full bg-dark-400 absolute hidden lg:block lg:top-[80.56%] lg:left-[37.3%]',
				rippleAnimation
			)}
			animate={{
				x: [-4, 4, -4],
			}}
			transition={{
				duration: 4,
				ease: 'easeInOut',
				times: [0, 0.4, 1, 1.6, 2],
				repeat: Infinity,
			}}
		>
			<Image
				src='/onboarding/person1.png'
				className='w-full h-full object-cover'
				width={81}
				height={81}
				alt='person1'
			/>
		</motion.div>
		<motion.div
			className={cx(
				'w-14 h-14 rounded-full bg-dark-400 absolute top-[30%] left-[35%] lg:top-[41.73%] lg:left-[43.81%]',
				rippleAnimation
			)}
			animate={{
				rotate: [-15, 15, -15],
			}}
			transition={{
				duration: 4,
				ease: 'easeInOut',
				times: [0, 0.4, 1, 1.6, 2],
				repeat: Infinity,
			}}
		>
			<Image
				src='/onboarding/person3.png'
				alt='person3'
				width={55}
				height={55}
			/>
		</motion.div>
		<motion.div
			className={cx(
				'w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-dark-400 absolute top-[71.92%] left-[51.8%]',
				rippleAnimation
			)}
			animate={{
				opacity: [0.7, 1, 0.7],
			}}
			transition={{
				duration: 4,
				ease: 'easeInOut',
				times: [0, 0.4, 1, 1.6, 2],
				repeat: Infinity,
				stiffness: 100,
			}}
		>
			<Image
				src='/onboarding/person5.png'
				alt='person5'
				width={81}
				height={81}
			/>
		</motion.div>
		<motion.div
			className={cx(
				'w-14 h-14 rounded-full bg-dark-400 absolute top-[18%] lg:top-[15.39%] left-[80%] lg:left-[53.43%]',
				rippleAnimation
			)}
			animate={{
				y: [-2, 2, -2],
			}}
			transition={{
				duration: 4,
				ease: 'easeInOut',
				times: [0, 0.4, 1, 1.6, 2],
				repeat: Infinity,
				stiffness: 200,
			}}
		>
			<Image
				src='/onboarding/person4.png'
				alt='person4'
				width={55}
				height={55}
			/>
		</motion.div>
		<motion.div
			className={cx(
				'w-[72px] h-[72px] lg:w-[81px] lg:h-[81px] rounded-full bg-dark-400 absolute  top-[65.88%] left-[80%] lg:left-[61.8%]',
				rippleAnimation
			)}
			animate={{
				rotateZ: [-5, 5, -5],
			}}
			transition={{
				duration: 4,
				ease: 'easeInOut',
				times: [0, 0.4, 1, 1.6, 2],
				repeat: Infinity,
			}}
		>
			<Image
				src='/onboarding/person6.png'
				alt='person6'
				width={81}
				height={81}
			/>
		</motion.div>
		<div
			className={cx(
				'bg-dark-200 absolute hidden lg:block rounded-full w-20 h-20 lg:top-[39.02%] lg:left-[36.8%]'
			)}
		/>
		<div
			className={cx(
				'bg-dark-400 absolute rounded-full w-20 h-20 top-[62.75%] lg:top-[74.92] left-[25%] lg:left-[44.45%]'
			)}
		/>
		<div
			className={cx(
				'bg-dark-400 absolute rounded-full w-14 h-14 top-[20%] left-[5%] lg:top-[43.46%] lg:left-[49.32%]'
			)}
		/>
		<div
			className={cx(
				'bg-dark-200 absolute hidden lg:block rounded-full w-14 h-14 lg:top-[12.93%] lg:left-[47.57%]'
			)}
		/>
		<div
			className={cx(
				'bg-dark-200 absolute rounded-full w-14 h-14 lg:w-20 lg:h-20 left-[65%] top-[45%] lg:top-[40.73%] lg:left-[56.06%]'
			)}
		/>
	</div>
)

export default People
