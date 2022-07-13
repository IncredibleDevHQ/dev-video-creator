/* eslint-disable no-console */
/* eslint-disable react-hooks/exhaustive-deps */
import axios from 'axios'
import { CodeBlockProps } from 'editor/src/utils/types'
import useEdit from 'icanvas/src/hooks/useEdit'
import Konva from 'konva'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { useRecoilValue, useRecoilState, useSetRecoilState } from 'recoil'
import studioStore, {
	colorCodesAtom,
	controlsConfigAtom,
	payloadFamily,
	StudioProviderProps,
	studioStateAtom,
	themeAtom,
} from 'src/stores/studio.store'
import {
	getThemeLayoutConfig,
	ObjectRenderConfig,
} from 'src/utils/canvasConfigs/themeConfig'
import { FragmentState } from 'src/utils/configs'
import useCode, { ComputedToken } from 'src/utils/hooks/useCode'
import {
	BlockProperties,
	CodeAnimation,
	CodeBlockView,
	CodeBlockViewProps,
	CodeHighlightConfig,
	CodeTheme,
	Layout,
	useEnv,
} from 'utils/src'
import { Group } from 'react-konva'
import {
	getFragmentLayoutConfig,
	ObjectConfig,
} from 'src/utils/canvasConfigs/fragmentLayoutConfig'
import {
	getShortsStudioUserConfiguration,
	getStudioUserConfiguration,
} from 'src/utils/canvasConfigs/studioUserConfig'
import { useDebouncedCallback } from 'use-debounce'
import useUpdatePayload from 'src/utils/hooks/useUpdatePayload'
import { UserContext } from 'src/utils/providers/auth'
import Concourse from '../Concourse'
import FragmentBackground from '../FragmentBackground'
import RenderTokens, {
	getAllLineNumbers,
	getRenderedTokens,
	getTokens,
	Position,
	RenderHighlight,
} from '../CodeAnimations'

export const getColorCodes = async (
	code: string,
	language: string,
	userToken: string,
	codeTheme: CodeTheme,
	endpoint: string
) =>
	axios.post(
		endpoint,
		{
			query: `
          query GetTokenisedCode(
            $code: String!
            $language: String!
            $theme: String
          ) {
            TokenisedCode(code: $code, language: $language, theme: $theme) {
              success
              data
            }
          }
        `,
			variables: {
				code,
				language: language || 'javascript',
				theme: codeTheme,
			},
		},
		{
			headers: {
				'Content-Type': 'application/json',
				authorization: `Bearer ${userToken}`,
			},
		}
	)

export const getSurfaceColor = ({ codeTheme }: { codeTheme: CodeTheme }) => {
	switch (codeTheme) {
		case 'light_vs':
			return '#ffffff'
		case 'light_plus':
			return '#ffffff'
		case 'quietlight':
			return '#f5f5f5'
		case 'solarized_light':
			return '#FDF6E3'
		case 'abyss':
			return '#000C18'
		case 'dark_vs':
			return '#1E1E1E'
		case 'dark_plus':
			return '#1E1E1E'
		case 'kimbie_dark':
			return '#221A0F'
		case 'monokai':
			return '#272822'
		case 'monokai_dimmed':
			return '#1E1E1E'
		case 'red':
			return '#390000'
		case 'solarized_dark':
			return '#002B36'
		case 'tomorrow_night_blue':
			return '#002451'
		case 'hc_black':
			return '#000000'
		default:
			return '#1E1E1E'
	}
}

const CodeFragment = ({
	viewConfig,
	dataConfig,
	fragmentState,
	setFragmentState,
	stageRef,
	shortsMode,
	isPreview,
	speakersLength,
}: {
	viewConfig: BlockProperties
	dataConfig: CodeBlockProps
	fragmentState: FragmentState
	setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
	stageRef: React.RefObject<Konva.Stage>
	shortsMode: boolean
	isPreview: boolean
	speakersLength: number
}) => {
	const { users } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
	const state = useRecoilValue(studioStateAtom)
	const theme = useRecoilValue(themeAtom)
	const payload = useRecoilValue(payloadFamily(dataConfig.id))
	const [codes, setCodes] = useRecoilState(colorCodesAtom)
	const { updatePayload, reset } = useUpdatePayload({
		blockId: dataConfig.id,
		shouldUpdateLiveblocks: !isPreview,
	})
	const setControlsConfig = useSetRecoilState(controlsConfigAtom)

	const { hasura } = useEnv()
	const { token: userToken } = useContext(UserContext)

	// const codePreviewValue = useRecoilValue(codePreviewStore)

	const { initUseCode } = useCode()
	const [computedTokens, setComputedTokens] = useState<ComputedToken[][]>([[]])
	const [position, setPosition] = useState<Position>({
		prevIndex: -1,
		currentIndex: 0,
	})
	// const [focusCode, setFocusCode] = useState<boolean>(false)

	// ref to the object grp
	const customLayoutRef = useRef<Konva.Group>(null)

	const codeGroupRef = useRef<Konva.Group>(null)
	const previewGroupRef = useRef<Konva.Group>(null)

	// states used for codex format
	// a bool state which tells if its a codex format or not
	const [codeAnimation, setCodeAnimation] = useState<CodeAnimation>()
	// a state which stores the active block info like index
	const [activeBlockIndex, setActiveBlockIndex] = useState<number>(0)
	// a state to tell if the block of code is focused or not
	// const [focusBlockCode, setFocusBlockCode] = useState<boolean>(false)
	const [highlightBlockCode, setHiglightBlockCode] = useState<boolean>(false)

	// config for focusing the lines of code in codex format
	const [blockConfig, setBlockConfig] = useState<CodeHighlightConfig[]>([])

	const [layout, setLayout] = useState<Layout | undefined>()

	const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		borderRadius: 0,
	})

	const [objectRenderConfig, setObjectRenderConfig] =
		useState<ObjectRenderConfig>({
			startX: 0,
			startY: 0,
			availableWidth: 0,
			availableHeight: 0,
			textColor: '',
			surfaceColor: '',
		})

	const [colorCodes, setColorCodes] = useState<any>([])
	const [codeTheme, setCodeTheme] = useState<CodeTheme>(CodeTheme.DarkPlus)
	const [fontSize, setFontSize] = useState<number>(16)

	// const [lineNumbers, setLineNumbers] = useState<number[]>([])

	const { clipRect } = useEdit()

	const debounceColorCodes = useDebouncedCallback(async value => {
		const { data } = await getColorCodes(
			value.decodedCode,
			value.language,
			value.token,
			value.theme,
			hasura.server
		)
		if (!data?.errors) {
			setColorCodes(data.data.TokenisedCode.data)
			setCodes({
				...codes,
				[dataConfig.id]: {
					code: value.decodedCode,
					colorCode: data.data.TokenisedCode.data,
					theme: value.theme,
				},
			})
		}
	}, 1000)

	useEffect(() => {
		setColorCodes([])
		setComputedTokens([[]])
		return () => {
			reset({
				currentIndex: 0,
				prevIndex: -1,
				isFocus: false,
				focusBlockCode: false,
				activeBlockIndex: 0,
				fragmentState: 'customLayout',
			})
		}
	}, [])

	useEffect(() => {
		if (!dataConfig) return
		updatePayload?.({
			currentIndex: 0,
			prevIndex: -1,
			isFocus: false,
			focusBlockCode: false,
			activeBlockIndex: 0,
		})
		const codeBlockViewProps: CodeBlockViewProps = (
			viewConfig?.view as CodeBlockView
		)?.code
		;(async () => {
			const code = codes?.[dataConfig.id]
			const decodedCode = dataConfig.codeBlock.code
				? Buffer.from(dataConfig.codeBlock.code, 'base64').toString('utf8')
				: undefined

			if (
				dataConfig.codeBlock.colorCodes &&
				codeBlockViewProps.theme === code?.theme
			) {
				setColorCodes(dataConfig.codeBlock.colorCodes)
			} else {
				try {
					if (
						decodedCode &&
						(code?.code !== decodedCode ||
							codeBlockViewProps?.theme !== code?.theme)
					) {
						debounceColorCodes({
							decodedCode,
							language: dataConfig.codeBlock.language || '',
							token: userToken,
							theme: codeBlockViewProps?.theme,
						})
					} else {
						setColorCodes(code?.colorCode)
					}
				} catch (e) {
					console.error(e)
					throw e
				}
			}
		})()
		setCodeAnimation(codeBlockViewProps?.animation)
		setCodeTheme(codeBlockViewProps?.theme)
		if (codeBlockViewProps?.fontSize) setFontSize(codeBlockViewProps.fontSize)
		const blocks = Object.assign([], codeBlockViewProps?.highlightSteps || [])
		blocks.unshift({ from: 0, to: 0, fileIndex: 0, lineNumbers: [] })
		// const blocks = [
		//   { lineNumbers: [] },
		//   { lineNumbers: [0] },
		//   { lineNumbers: [2, 5] },
		//   { lineNumbers: [3, 4] },
		//   // { lineNumbers: [3] },
		// ]
		setBlockConfig(blocks)
	}, [dataConfig, shortsMode, viewConfig, theme, codes?.[dataConfig.id]])

	useEffect(() => {
		setObjectConfig(
			getFragmentLayoutConfig({
				theme,
				layout: !isPreview
					? layout || viewConfig?.layout || 'classic'
					: viewConfig?.layout || 'classic',
				isShorts: shortsMode || false,
			})
		)
	}, [shortsMode, viewConfig, theme, layout, isPreview])

	useEffect(() => {
		setObjectRenderConfig(
			getThemeLayoutConfig({ theme, layoutConfig: objectConfig })
		)
	}, [objectConfig, theme])

	useEffect(() => {
		if (!colorCodes) return
		if (colorCodes.length === 0) return
		setComputedTokens(
			initUseCode({
				tokens: [colorCodes],
				canvasWidth: objectConfig.width - 140,
				canvasHeight: objectRenderConfig.availableHeight - 35,
				gutter: 8,
				fontSize,
				codeAnimation: codeAnimation || CodeAnimation.TypeLines,
				// fontFamily: branding?.font?.heading?.family,
			})
		)
	}, [colorCodes, objectRenderConfig, fontSize])

	useEffect(() => {
		setControlsConfig({
			updatePayload,
			blockId: dataConfig.id,
			position,
			computedTokens: computedTokens[0],
		})
	}, [state, position, computedTokens])

	useEffect(() => {
		setPosition({
			prevIndex: payload?.prevIndex || -1,
			currentIndex: payload?.currentIndex || 0,
		})
		// setFocusCode(payload?.isFocus)
		// if (codeAnimation === 'Insert in between') {
		//   setActiveBlockIndex(payload?.activeBlockIndex)
		//   setLineNumbers((oldLineNumbers) => [
		//     ...oldLineNumbers,
		//     ...(blockConfig?.[payload?.activeBlockIndex]?.lineNumbers || []),
		//   ])
		// }
		if (codeAnimation === 'Highlight lines') {
			if (payload?.activeBlockIndex === undefined) return
			setActiveBlockIndex(payload?.activeBlockIndex)
			if (payload?.focusBlockCode) {
				if (
					(computedTokens[
						blockConfig?.[payload?.activeBlockIndex]?.fileIndex || 0
					].find(
						token =>
							token.lineNumber ===
								(blockConfig &&
									blockConfig[payload?.activeBlockIndex || 0] &&
									blockConfig[payload?.activeBlockIndex || 0].from) || 0
					)?.y || 0) >
					objectRenderConfig.availableHeight / 2
				) {
					let valueToCenterTheHighlight = 20
					if (
						objectRenderConfig.availableHeight -
							((blockConfig?.[payload?.activeBlockIndex]?.to || 0) -
								(blockConfig?.[payload?.activeBlockIndex]?.from || 0) +
								// adding 1 bcoz subracting the to and from will give one line less
								1) *
								(fontSize + 8) >
						0
					) {
						// calculating the height of the highlighted part and subtracting it with the total available height and dividing it by 2 to place it in the center
						valueToCenterTheHighlight =
							objectRenderConfig.availableHeight -
							((blockConfig?.[payload?.activeBlockIndex]?.to || 0) -
								(blockConfig?.[payload?.activeBlockIndex]?.from || 0) +
								// adding 1 bcoz subracting the to and from will give one line less
								1) *
								(fontSize + 8)
					}
					codeGroupRef.current?.to({
						y:
							-(
								computedTokens[
									blockConfig?.[payload?.activeBlockIndex]?.fileIndex || 0
								].find(
									token =>
										token.lineNumber ===
											blockConfig?.[payload?.activeBlockIndex || 0]?.from || 0
								)?.y || 0
							) +
							valueToCenterTheHighlight / 2 +
							// this is the starting y of the code block
							objectRenderConfig.startY +
							15,
						duration: 0.5,
						easing: Konva.Easings.EaseInOut,
					})
				} else {
					codeGroupRef.current?.to({
						y: objectRenderConfig.startY + 24,
						duration: 0.5,
						easing: Konva.Easings.EaseInOut,
					})
				}
				setHiglightBlockCode(payload?.focusBlockCode)
			} else {
				setHiglightBlockCode(false)
			}
		}
	}, [payload])

	useEffect(() => {
		if (state === 'ready') {
			setPosition({
				prevIndex: -1,
				currentIndex: 0,
			})
			if (codeAnimation === 'Type lines')
				updatePayload?.({
					prevIndex: -1,
					currentIndex: 0,
					isFocus: false,
				})
			else
				updatePayload?.({
					focusBlockCode: false,
					activeBlockIndex: 0,
				})
		}
		if (state === 'recording') {
			setPosition({
				prevIndex: -1,
				currentIndex: 0,
			})
			if (codeAnimation === 'Type lines')
				updatePayload?.({
					prevIndex: -1,
					currentIndex: 0,
					isFocus: false,
				})
			else
				updatePayload?.({
					focusBlockCode: false,
					activeBlockIndex: 0,
				})
		}
	}, [state, codeAnimation])

	useEffect(() => {
		// Checking if the current state is only fragment group and making the opacity of the only fragment group 1
		if (payload.fragmentState === 'customLayout') {
			if (!shortsMode) {
				setTimeout(() => {
					setLayout(viewConfig?.layout || 'classic')
					setFragmentState('customLayout')
					customLayoutRef?.current?.to({
						opacity: 1,
						duration: 0.1,
					})
				}, 400)
			} else {
				setLayout(viewConfig?.layout || 'classic')
				setFragmentState(payload?.fragmentState)
				customLayoutRef?.current?.to({
					opacity: 1,
					duration: 0.1,
				})
			}
		}
		// Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
		if (payload?.fragmentState === 'onlyUserMedia') {
			if (!shortsMode)
				setTimeout(() => {
					setFragmentState('onlyUserMedia')
					customLayoutRef?.current?.to({
						opacity: 0,
						duration: 0.1,
					})
				}, 400)
			else {
				setFragmentState(payload?.fragmentState)
				customLayoutRef?.current?.to({
					opacity: 0,
					duration: 0.1,
				})
			}
		}
		if (payload?.fragmentState === 'onlyFragment') {
			if (!shortsMode)
				setTimeout(() => {
					setLayout('classic')
					setFragmentState('onlyFragment')
					customLayoutRef?.current?.to({
						opacity: 1,
						duration: 0.1,
					})
				}, 400)
			else {
				setLayout('classic')
				setFragmentState(payload?.fragmentState)
				customLayoutRef?.current?.to({
					opacity: 1,
					duration: 0.1,
				})
			}
		}
	}, [payload?.fragmentState])

	// TODO
	// useEffect(() => {
	// 	previewGroupRef?.current?.to({
	// 		y:
	// 			-(codePreviewValue * (8 * (fontSize + 8))) +
	// 			objectRenderConfig.startY +
	// 			24,
	// 		duration: 0.5,
	// 		easing: Konva.Easings.EaseInOut,
	// 	})
	// }, [objectRenderConfig, codePreviewValue])

	// useEffect(() => {
	// 	if (fragment?.configuration?.continuousRecording) {
	// 		if (
	// 			payload?.fragmentState === 'customLayout' ||
	// 			payload?.fragmentState === 'onlyFragment'
	// 		) {
	// 			setLayout(viewConfig?.layout || 'classic')
	// 			customLayoutRef?.current?.to({
	// 				opacity: 1,
	// 			})
	// 		}
	// 	}
	// }, [])

	const layerChildren: any[] = [
		<Group x={0} y={0} opacity={isPreview ? 1 : 0} ref={customLayoutRef}>
			<FragmentBackground
				theme={theme}
				objectConfig={objectConfig}
				backgroundRectColor={getSurfaceColor({ codeTheme })}
			/>
			<Group
				clipFunc={(ctx: any) => {
					clipRect(ctx, {
						x: objectRenderConfig.startX,
						y: objectRenderConfig.startY + 24,
						width: objectRenderConfig.availableWidth,
						height: objectRenderConfig.availableHeight,
						borderRadius: 0,
					})
				}}
			>
				{!isPreview ? (
					<Group
						x={objectRenderConfig.startX + 25}
						y={objectRenderConfig.startY + 24}
						key='group'
						ref={codeGroupRef}
					>
						{
							{
								'Type lines': (
									<>
										{getRenderedTokens(computedTokens[0], position, fontSize)}
										{computedTokens.length > 0 &&
											computedTokens[0].length > 0 && (
												<RenderTokens
													key={position.prevIndex}
													tokens={computedTokens[0]}
													startIndex={position.prevIndex}
													endIndex={position.currentIndex}
													fontSize={fontSize}
												/>
											)}
									</>
								),
								'Highlight lines': (
									<>
										{computedTokens.length > 0 && computedTokens[0].length > 0 && (
											<>
												<Group x={-15}>
													{getAllLineNumbers(computedTokens[0], fontSize)}
												</Group>
												<Group x={40}>
													{getTokens({
														tokens: computedTokens[0],
														opacity: highlightBlockCode ? 0.2 : 1,
														fontSize,
													})}
												</Group>
											</>
										)}
										{highlightBlockCode && (
											<Group x={40}>
												<RenderHighlight
													tokens={computedTokens[0]}
													startLineNumber={
														(blockConfig &&
															blockConfig[activeBlockIndex] &&
															blockConfig[activeBlockIndex].from) ||
														0
													}
													endLineNumber={
														(blockConfig &&
															blockConfig[activeBlockIndex] &&
															blockConfig[activeBlockIndex].to) ||
														0
													}
													fontSize={fontSize}
												/>
											</Group>
										)}
									</>
								),
								// 'Insert in between': (
								//   <>
								//     <Group x={-15}>
								//       {getSomeLineNumbers({
								//         tokens: computedTokens[0],
								//         lineNumbers,
								//         fontSize,
								//       })}
								//     </Group>
								//     <Group x={40}>
								//       <RenderLines
								//         tokens={computedTokens[0]}
								//         lineNumbers={lineNumbers}
								//         fontSize={fontSize}
								//       />
								//     </Group>
								//   </>
								// ),
							}[codeAnimation || 'Type lines']
						}
					</Group>
				) : (
					<Group
						x={objectRenderConfig.startX + 25}
						y={objectRenderConfig.startY + 24}
						key='previewGroup'
						ref={previewGroupRef}
					>
						<Group x={-15}>
							{getAllLineNumbers(computedTokens[0], fontSize)}
						</Group>
						<Group x={40}>
							{getTokens({
								tokens: computedTokens[0],
								opacity: 1,
								fontSize,
							})}
						</Group>
					</Group>
				)}
			</Group>
		</Group>,
	]

	const studioUserConfig = !shortsMode
		? getStudioUserConfiguration({
				layout: !isPreview
					? layout || 'classic'
					: viewConfig?.layout || 'classic',
				noOfParticipants: !isPreview ? users.length + 1 : speakersLength,
				fragmentState,
				theme,
		  })
		: getShortsStudioUserConfiguration({
				layout: !isPreview
					? layout || 'classic'
					: viewConfig?.layout || 'classic',
				noOfParticipants: !isPreview ? users.length + 1 : speakersLength,
				fragmentState,
				theme,
		  })

	return (
		<Concourse
			layerChildren={layerChildren}
			viewConfig={viewConfig}
			stageRef={stageRef}
			studioUserConfig={studioUserConfig}
			isShorts={shortsMode}
			blockType={dataConfig.type}
			fragmentState={fragmentState}
			updatePayload={updatePayload}
			blockId={dataConfig.id}
		/>
	)
}

export default CodeFragment
