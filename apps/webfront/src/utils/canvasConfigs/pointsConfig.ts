import { Layout } from "utils/src"
import { getCanvasGradient } from "./studioUserConfig"

export interface PointsConfig {
	textFontSize: number
	paddingBtwBulletText: number
	noOfPoints: number
	// no of points to render in a screen and used for spacing the points approiately
	noForSpacing: number
}

export const getPointsConfig = ({
	layout,
	isShorts,
}: {
	layout: Layout
	isShorts: boolean
}): PointsConfig => {
	if (!isShorts) {
		switch (layout) {
			case 'classic':
				return {
					paddingBtwBulletText: 36,
					textFontSize: 16,
					noOfPoints: 3,
					noForSpacing: 4,
				}
			case 'float-full-right':
			case 'float-full-left':
				return {
					paddingBtwBulletText: 36,
					textFontSize: 16,
					noOfPoints: 2,
					noForSpacing: 3,
				}
			case 'float-half-right':
			case 'padded-bottom-right-tile':
			case 'padded-bottom-right-circle':
			case 'bottom-right-tile':
			case 'bottom-right-circle':
				return {
					paddingBtwBulletText: 36,
					textFontSize: 16,
					noOfPoints: 2,
					noForSpacing: 4,
				}
			case 'padded-split':
			case 'split':
			case 'full-left':
			case 'full-right':
				return {
					paddingBtwBulletText: 24,
					textFontSize: 14,
					noOfPoints: 1,
					noForSpacing: 2,
				}
			default:
				return {
					paddingBtwBulletText: 36,
					textFontSize: 16,
					noOfPoints: 3,
					noForSpacing: 4,
				}
		}
	} else {
		switch (layout) {
			case 'classic':
			case 'float-half-right':
			case 'padded-bottom-right-tile':
			case 'padded-bottom-right-circle':
			case 'bottom-right-tile':
			case 'bottom-right-circle':
				return {
					paddingBtwBulletText: 36,
					textFontSize: 16,
					noOfPoints: 1,
					noForSpacing: 2,
				}
			case 'split':
				return {
					paddingBtwBulletText: 36,
					textFontSize: 16,
					noOfPoints: 1,
					noForSpacing: 2,
				}
			case 'full-left':
				return {
					paddingBtwBulletText: 36,
					textFontSize: 12,
					noOfPoints: 1,
					noForSpacing: 2,
				}
			default:
				return {
					paddingBtwBulletText: 36,
					textFontSize: 16,
					noOfPoints: 1,
					noForSpacing: 2,
				}
		}
	}
}

export interface BulletsConfig {
	bulletWidth: number
	bulletHeight: number
	bulletFontSize: number
	bulletFontStyle?: string
	bulletCornerRadius: number
	bulletXOffset: number
	bulletYOffset: number
	bulletColor: CanvasGradient | string | string[] | undefined
	bulletTextColor: string
	bulletRotation: number
	bulletBgRectXOffset?: number
	bulletBgRectYOffset?: number
	bulletBgRectWidth?: number
	bulletBgRectHeight?: number
	bulletBgRectCornerRadius?: number
	bulletBgRectColor?: CanvasGradient | string | string[] | undefined
}

export const getBulletsConfig = ({
	theme,
	layout,
}: {
	theme: string
	layout: Layout
}): BulletsConfig => {
	switch (theme) {
		case 'DarkGradient':
			switch (layout) {
				case 'classic':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
					return {
						bulletWidth: 64,
						bulletHeight: 64,
						bulletFontSize: 32,
						bulletCornerRadius: 8,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
				case 'float-full-right':
				case 'float-full-left':
					return {
						bulletWidth: 48,
						bulletHeight: 48,
						bulletFontSize: 24,
						bulletCornerRadius: 8,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 36,
						bulletHeight: 36,
						bulletFontSize: 18,
						bulletCornerRadius: 8,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
				default:
					return {
						bulletWidth: 64,
						bulletHeight: 64,
						bulletFontSize: 32,
						bulletCornerRadius: 8,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
			}
		case 'PastelLines':
			switch (layout) {
				case 'classic':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
					return {
						bulletWidth: 64,
						bulletHeight: 64,
						bulletFontSize: 32,
						bulletCornerRadius: 0,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
				case 'float-full-right':
				case 'float-full-left':
					return {
						bulletWidth: 48,
						bulletHeight: 48,
						bulletFontSize: 24,
						bulletCornerRadius: 0,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 36,
						bulletHeight: 36,
						bulletFontSize: 18,
						bulletCornerRadius: 0,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
				default:
					return {
						bulletWidth: 64,
						bulletHeight: 64,
						bulletFontSize: 32,
						bulletCornerRadius: 0,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
			}
		case 'Cassidoo':
			switch (layout) {
				case 'classic':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
					return {
						bulletWidth: 64,
						bulletHeight: 64,
						bulletFontSize: 32,
						bulletCornerRadius: 16,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
				case 'float-full-right':
				case 'float-full-left':
					return {
						bulletWidth: 48,
						bulletHeight: 48,
						bulletFontSize: 24,
						bulletCornerRadius: 16,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 36,
						bulletHeight: 36,
						bulletFontSize: 18,
						bulletCornerRadius: 16,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
				default:
					return {
						bulletWidth: 64,
						bulletHeight: 64,
						bulletFontSize: 32,
						bulletCornerRadius: 16,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#ffffff',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
			}
		case 'LambdaTest':
			switch (layout) {
				case 'classic':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
					return {
						bulletWidth: 64,
						bulletHeight: 64,
						bulletFontSize: 32,
						bulletCornerRadius: 4,
						bulletXOffset: 32,
						bulletYOffset: 32,
						bulletColor: '#0EBAC5',
						bulletTextColor: '#ffffff',
						bulletRotation: -45,
					}
				case 'float-full-right':
				case 'float-full-left':
					return {
						bulletWidth: 48,
						bulletHeight: 48,
						bulletFontSize: 24,
						bulletCornerRadius: 4,
						bulletXOffset: 24,
						bulletYOffset: 24,
						bulletColor: '#0EBAC5',
						bulletTextColor: '#ffffff',
						bulletRotation: -45,
					}
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 36,
						bulletHeight: 36,
						bulletFontSize: 18,
						bulletCornerRadius: 4,
						bulletXOffset: 18,
						bulletYOffset: 18,
						bulletColor: '#0EBAC5',
						bulletTextColor: '#ffffff',
						bulletRotation: -45,
					}
				default:
					return {
						bulletWidth: 64,
						bulletHeight: 64,
						bulletFontSize: 32,
						bulletCornerRadius: 4,
						bulletXOffset: 32,
						bulletYOffset: 32,
						bulletColor: '#0EBAC5',
						bulletTextColor: '#ffffff',
						bulletRotation: -45,
					}
			}
		case 'LeeRob':
			switch (layout) {
				case 'classic':
				case 'float-full-right':
				case 'float-full-left':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 32,
						bulletHeight: 32,
						bulletFontSize: 16,
						bulletFontStyle: 'bold',
						bulletCornerRadius: 16,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: getCanvasGradient(
							[
								{ color: '#EA369B', offset: 0.0 },
								{ color: '#8165D6', offset: 0.5208 },
								{ color: '#48A8F6', offset: 0.8764 },
							],
							{
								x0: 0,
								y0: 16,
								x1: 48,
								y1: 16,
							}
						),
						bulletTextColor: '#ffffff',
						bulletRotation: 0,
					}
				default:
					return {
						bulletWidth: 32,
						bulletHeight: 32,
						bulletFontSize: 16,
						bulletCornerRadius: 16,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: getCanvasGradient(
							[
								{ color: '#EA369B', offset: 0.0 },
								{ color: '#8165D6', offset: 0.5208 },
								{ color: '#48A8F6', offset: 0.8764 },
							],
							{
								x0: 0,
								y0: 16,
								x1: 32,
								y1: 16,
							}
						),
						bulletTextColor: '#ffffff',
						bulletRotation: 0,
					}
			}
		case 'Web3Auth':
			switch (layout) {
				case 'classic':
				case 'float-full-right':
				case 'float-full-left':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 44,
						bulletHeight: 44,
						bulletFontSize: 16,
						bulletCornerRadius: 22,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: ['#B114FB', '#FB4A61', '#30CCA4', '#1AC7FE'],
						bulletTextColor: '#ffffff',
						bulletRotation: 0,
						bulletBgRectColor: ['#B114FB', '#FB4A61', '#30CCA4', '#1AC7FE'],
						bulletBgRectXOffset: -10,
						bulletBgRectYOffset: -10,
						bulletBgRectWidth: 64,
						bulletBgRectHeight: 64,
						bulletBgRectCornerRadius: 32,
					}
				default:
					return {
						bulletWidth: 44,
						bulletHeight: 44,
						bulletFontSize: 16,
						bulletCornerRadius: 22,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: ['#B114FB', '#FB4A61', '#30CCA4', '#1AC7FE'],
						bulletTextColor: '#ffffff',
						bulletRotation: 0,
						bulletBgRectColor: ['#B114FB', '#FB4A61', '#30CCA4', '#1AC7FE'],
						bulletBgRectXOffset: -10,
						bulletBgRectYOffset: -10,
						bulletBgRectWidth: 64,
						bulletBgRectHeight: 64,
						bulletBgRectCornerRadius: 32,
					}
			}
		case 'DevsForUkraine':
			switch (layout) {
				case 'classic':
				case 'float-full-right':
				case 'float-full-left':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 32,
						bulletHeight: 32,
						bulletFontSize: 16,
						bulletFontStyle: 'bold',
						bulletCornerRadius: 16,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#2696FA',
						bulletTextColor: '#ffffff',
						bulletRotation: 0,
					}
				default:
					return {
						bulletWidth: 32,
						bulletHeight: 32,
						bulletFontSize: 16,
						bulletFontStyle: 'bold',
						bulletCornerRadius: 16,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#2696FA',
						bulletTextColor: '#ffffff',
						bulletRotation: 0,
					}
			}
		case 'Whitep4nth3r':
			switch (layout) {
				case 'classic':
				case 'float-full-right':
				case 'float-full-left':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 40,
						bulletHeight: 40,
						bulletFontSize: 20,
						bulletFontStyle: 'bold',
						bulletCornerRadius: 8,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#FFB626',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
				default:
					return {
						bulletWidth: 40,
						bulletHeight: 40,
						bulletFontSize: 20,
						bulletFontStyle: 'bold',
						bulletCornerRadius: 8,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#FFB626',
						bulletTextColor: '#000000',
						bulletRotation: 0,
					}
			}
		case 'VetsWhoCode':
			switch (layout) {
				case 'classic':
				case 'float-full-right':
				case 'float-full-left':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 40,
						bulletHeight: 40,
						bulletFontSize: 0,
						bulletFontStyle: '',
						bulletCornerRadius: 0,
						bulletXOffset: 17,
						bulletYOffset: 17,
						bulletColor: '#C5203E',
						bulletTextColor: '',
						bulletRotation: 0,
					}
				default:
					return {
						bulletWidth: 40,
						bulletHeight: 40,
						bulletFontSize: 0,
						bulletFontStyle: '',
						bulletCornerRadius: 0,
						bulletXOffset: 17,
						bulletYOffset: 17,
						bulletColor: '#C5203E',
						bulletTextColor: '',
						bulletRotation: 0,
					}
			}
		case 'ShrutiKapoor':
			switch (layout) {
				case 'classic':
				case 'float-full-right':
				case 'float-full-left':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
				case 'padded-split':
				case 'split':
					return {
						bulletWidth: 64,
						bulletHeight: 64,
						bulletFontSize: 20,
						bulletFontStyle: '',
						bulletCornerRadius: 0,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: getCanvasGradient(
							[
								{ color: '#FA709A', offset: 0.0 },
								{ color: '#FEE140', offset: 0.5156 },
								{ color: '#FEE1407B', offset: 1.0 },
							],
							{
								x0: 64,
								y0: 0,
								x1: 0,
								y1: 64,
							}
						),
						bulletTextColor: '#ffffff',
						bulletRotation: 0,
					}
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 40,
						bulletHeight: 40,
						bulletFontSize: 15,
						bulletFontStyle: '',
						bulletCornerRadius: 0,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: getCanvasGradient(
							[
								{ color: '#FA709A', offset: 0.0 },
								{ color: '#FEE140', offset: 0.5156 },
								{ color: '#FEE1407B', offset: 1.0 },
							],
							{
								x0: 40,
								y0: 0,
								x1: 0,
								y1: 40,
							}
						),
						bulletTextColor: '#ffffff',
						bulletRotation: 0,
					}
				default:
					return {
						bulletWidth: 40,
						bulletHeight: 40,
						bulletFontSize: 0,
						bulletFontStyle: '',
						bulletCornerRadius: 0,
						bulletXOffset: 17,
						bulletYOffset: 17,
						bulletColor: '#C5203E',
						bulletTextColor: '',
						bulletRotation: 0,
					}
			}
		case 'Mux':
			switch (layout) {
				case 'classic':
				case 'float-full-right':
				case 'float-full-left':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 48,
						bulletHeight: 48,
						bulletFontSize: 20,
						bulletFontStyle: 'normal',
						bulletCornerRadius: 0,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: getCanvasGradient(
							[
								{ color: '#EB4F3E', offset: 0.0 },
								{ color: '#EB4463', offset: 0.7604 },
							],
							{
								x0: 0,
								y0: 24,
								x1: 48,
								y1: 24,
							}
						),
						bulletTextColor: '#ffffff',
						bulletRotation: 0,
					}
				default:
					return {
						bulletWidth: 40,
						bulletHeight: 40,
						bulletFontSize: 0,
						bulletFontStyle: '',
						bulletCornerRadius: 0,
						bulletXOffset: 17,
						bulletYOffset: 17,
						bulletColor: '#C5203E',
						bulletTextColor: '',
						bulletRotation: 0,
					}
			}
		case 'WunderGraph':
			switch (layout) {
				case 'classic':
				case 'float-full-right':
				case 'float-full-left':
				case 'float-half-right':
				case 'padded-bottom-right-tile':
				case 'padded-bottom-right-circle':
				case 'bottom-right-tile':
				case 'bottom-right-circle':
				case 'padded-split':
				case 'split':
				case 'full-left':
				case 'full-right':
					return {
						bulletWidth: 48,
						bulletHeight: 48,
						bulletFontSize: 20,
						bulletFontStyle: 'normal 500',
						bulletCornerRadius: 4,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#90C4FD',
						bulletTextColor: '#1A202C',
						bulletRotation: 0,
					}
				default:
					return {
						bulletWidth: 48,
						bulletHeight: 48,
						bulletFontSize: 20,
						bulletFontStyle: 'normal 500',
						bulletCornerRadius: 4,
						bulletXOffset: 0,
						bulletYOffset: 0,
						bulletColor: '#90C4FD',
						bulletTextColor: '#1A202C',
						bulletRotation: 0,
					}
			}
		default:
			return {
				bulletWidth: 64,
				bulletHeight: 64,
				bulletFontSize: 32,
				bulletCornerRadius: 32,
				bulletXOffset: 0,
				bulletYOffset: 0,
				bulletColor: '#2D2D2D',
				bulletTextColor: '#FFFFFF',
				bulletRotation: 0,
			}
	}
}
