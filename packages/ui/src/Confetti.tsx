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
