import { ThemeFragment } from "src/graphql/generated";
import { BrandingJSON } from "src/utils/configs";
import { IntroBlockViewProps, TopLayerChildren } from "utils/src"
import LowerThridProvider from "./LowerThirdProvider";
import TransitionProvider from "./TransitionProvider";

const GetTopLayerChildren = ({
	topLayerChildrenState,
	setTopLayerChildren,
	isShorts,
	theme,
	transitionSettings,
	branding,
	performFinishAction,
  introBlockViewProps,
  speakersLength,
}: {
	topLayerChildrenState: TopLayerChildren
	setTopLayerChildren: React.Dispatch<
		React.SetStateAction<{ id: string; state: TopLayerChildren }>
	>
	isShorts: boolean
	theme: ThemeFragment
	transitionSettings?: { blockTransition?: string; swapTransition?: string }
	branding?: BrandingJSON | null
	performFinishAction?: () => void
  introBlockViewProps?: IntroBlockViewProps
  speakersLength: number
}) => {
	switch (topLayerChildrenState) {
		case 'lowerThird': {
			return (
				<LowerThridProvider
					theme={theme}
					isShorts={isShorts || false}
					setTopLayerChildren={setTopLayerChildren}
					brandingJSON={branding}
					introBlockViewProps={introBlockViewProps}
          speakersLength={speakersLength}
				/>
			)
		}
		case 'transition left': {
			return (
				<TransitionProvider
					theme={theme}
					isShorts={isShorts || false}
					direction='left'
					setTopLayerChildren={setTopLayerChildren}
					brandingJSON={branding}
					transitionSettings={transitionSettings?.swapTransition}
				/>
			)
		}
		case 'transition right': {
			return (
				<TransitionProvider
					theme={theme}
					isShorts={isShorts || false}
					direction='right'
					setTopLayerChildren={setTopLayerChildren}
					brandingJSON={branding}
					transitionSettings={transitionSettings?.swapTransition}
				/>
			)
		}
		case 'transition moveIn': {
			return (
				<TransitionProvider
					theme={theme}
					isShorts={isShorts || false}
					direction='moveIn'
					setTopLayerChildren={setTopLayerChildren}
					performFinishAction={performFinishAction}
					brandingJSON={branding}
					transitionSettings={transitionSettings?.blockTransition}
				/>
			)
		}
		case 'transition moveAway': {
			return (
				<TransitionProvider
					theme={theme}
					isShorts={isShorts || false}
					direction='moveAway'
					setTopLayerChildren={setTopLayerChildren}
					brandingJSON={branding}
					transitionSettings={transitionSettings?.blockTransition}
				/>
			)
		}
		case '':
			return null
		default:
			return null
	}
}

 export default GetTopLayerChildren
