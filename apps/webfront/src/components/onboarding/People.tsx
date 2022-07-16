/* eslint-disable @next/next/no-img-element */
import { css, cx } from '@emotion/css'
import { motion } from 'framer-motion'
import React from 'react'

const positionCSS = ({
	top,
	left,
	right,
	bottom,
}: {
	top?: number
	left?: number
	right?: number
	bottom?: number
}) => css`
	${top && `top: ${top}%;`}
	${left && `left: ${left}%;`}
  ${right && `right: ${right}%;`}
  ${bottom && `bottom: ${bottom}%;`}
`

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
				'w-14 h-14 rounded-full bg-dark-400 absolute',
				positionCSS({
					top: 58.6,
					left: 30.95,
				}),
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
			<img
				src='/onboarding/person2.png'
				className='w-full h-full object-cover'
				alt='person1'
			/>
		</motion.div>
		<motion.div
			className={cx(
				'w-20 h-20 rounded-full bg-dark-400 absolute',
				positionCSS({
					top: 80.56,
					left: 37.3,
				}),
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
			<img
				src='/onboarding/person1.png'
				className='w-full h-full object-cover'
				alt='person1'
			/>
		</motion.div>
		<motion.div
			className={cx(
				'w-14 h-14 rounded-full bg-dark-400 absolute',
				positionCSS({
					top: 41.73,
					left: 43.81,
				}),
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
			<img
				src='/onboarding/person3.png'
				className='w-full h-full object-cover'
				alt='person1'
			/>
		</motion.div>
		<motion.div
			className={cx(
				'w-20 h-20 rounded-full bg-dark-400 absolute',
				positionCSS({
					top: 71.92,
					left: 51.8,
				}),
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
			<img
				src='/onboarding/person5.png'
				className='w-full h-full object-cover'
				alt='person1'
			/>
		</motion.div>
		<motion.div
			className={cx(
				'w-14 h-14 rounded-full bg-dark-400 absolute',
				positionCSS({
					top: 15.39,
					left: 53.43,
				}),
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
			<img
				src='/onboarding/person4.png'
				className='w-full h-full object-cover'
				alt='person1'
			/>
		</motion.div>
		<motion.div
			className={cx(
				'w-24 h-24 rounded-full bg-dark-400 absolute',
				positionCSS({
					top: 65.88,
					left: 61.8,
				}),
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
			<img
				src='/onboarding/person6.png'
				className='w-full h-full object-cover'
				alt='person1'
			/>
		</motion.div>
		<div
			className={cx(
				'bg-dark-200 absolute rounded-full w-20 h-20',
				positionCSS({
					top: 39.02,
					left: 36.8,
				})
			)}
		/>
		<div
			className={cx(
				'bg-dark-400 absolute rounded-full w-20 h-20',
				positionCSS({
					top: 74.92,
					left: 44.45,
				})
			)}
		/>
		<div
			className={cx(
				'bg-dark-400 absolute rounded-full w-14 h-14',
				positionCSS({
					top: 43.46,
					left: 49.32,
				})
			)}
		/>
		<div
			className={cx(
				'bg-dark-200 absolute rounded-full w-14 h-14',
				positionCSS({
					top: 12.93,
					left: 47.57,
				})
			)}
		/>
		<div
			className={cx(
				'bg-dark-200 absolute rounded-full w-20 h-20',
				positionCSS({
					top: 40.73,
					left: 56.06,
				})
			)}
		/>
	</div>
)

export default People
