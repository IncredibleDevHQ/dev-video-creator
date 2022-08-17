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

/* eslint-disable react/no-unused-class-component-methods */
/* eslint-disable react/jsx-no-useless-fragment */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import React from 'react'
import ReactCanvasConfetti from 'react-canvas-confetti'

export class Confetti extends React.Component<{ fire?: boolean }> {
	animationInstance: any

	isAnimationEnabled: boolean

	constructor(props: any) {
		super(props)
		this.isAnimationEnabled = false
		this.animationInstance = null
		this.nextTickAnimation = this.nextTickAnimation.bind(this)
	}

	componentDidUpdate() {
		this.props.fire ? this.handlerClickStart() : this.handlerClickPause()
	}

	componentWillUnmount() {
		this.isAnimationEnabled = false
	}

	makeShot = (angle: any, originX: any) => {
		this.animationInstance &&
			this.animationInstance({
				particleCount: 3,
				angle,
				spread: 55,
				origin: { x: originX },
				colors: ['#16A34A', '#28292d', '#fafafa'],
			})
	}

	nextTickAnimation = () => {
		this.makeShot(60, 0)
		this.makeShot(120, 1)
		if (this.isAnimationEnabled) requestAnimationFrame(this.nextTickAnimation)
	}

	startAnimation = () => {
		if (!this.isAnimationEnabled) {
			this.isAnimationEnabled = true
			this.nextTickAnimation()
		}
	}

	pauseAnimation = () => {
		this.isAnimationEnabled = false
	}

	stopAnimation = () => {
		this.isAnimationEnabled = false
		this.animationInstance && this.animationInstance.reset()
	}

	handlerClickStart = () => {
		this.startAnimation()
	}

	handlerClickPause = () => {
		this.pauseAnimation()
	}

	handlerClickStop = () => {
		this.stopAnimation()
	}

	getInstance = (instance: any) => {
		this.animationInstance = instance
	}

	render() {
		return (
			<>
				<ReactCanvasConfetti
					refConfetti={this.getInstance}
					className='absolute top-0 left-0 h-full w-full overflow-x-hidden pointer-events-none'
				/>
			</>
		)
	}
}
