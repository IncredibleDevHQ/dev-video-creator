import React from 'react'
import { useRecoilValue } from 'recoil'
import { ThemeFragment } from 'src/graphql/generated'
import { brandingAtom } from 'src/stores/studio.store'
import { BrandingJSON, CONFIG, SHORTS_CONFIG } from 'src/utils/configs'
import { useUser } from 'src/utils/providers/auth'
import { IntroBlockViewProps, TopLayerChildren } from 'utils/src'
import {
	CassidooLowerThirds,
	DevsForUkraineLowerThirds,
	GlassyLowerThirds,
	LambdaTestLowerThirds,
	LeeRobLowerThirds,
	MuxLowerThirds,
	PastelLinesLowerThirds,
	ShrutiKapoorLowerThirds,
	VetsWhoCodeLowerThirds,
	Web3AuthLowerThirds,
	Whitep4nth3rLowerThirds,
	WunderGraphLowerThirds,
} from './LowerThirds'

const LowerThridProvider = ({
	theme,
	isShorts,
	setTopLayerChildren,
	brandingJSON,
	introBlockViewProps,
	speakersLength,
}: {
	theme: ThemeFragment
	isShorts: boolean
	setTopLayerChildren?: React.Dispatch<
		React.SetStateAction<{ id: string; state: TopLayerChildren }>
	>
	brandingJSON?: BrandingJSON | null
	introBlockViewProps?: IntroBlockViewProps
	speakersLength: number
}) => {
	const branding = useRecoilValue(brandingAtom) || brandingJSON
	// const users = useRecoilValue(agoraUsersAtom)
	// holds the user's display name
	const { user } = useUser()
	const lowerThirdUserName = introBlockViewProps?.name || user?.displayName
	const lowerThirdUserDesignation =
		introBlockViewProps?.designation || user?.designation
	const lowerThirdUserOrganization =
		introBlockViewProps?.organization || user?.organization

	const lowerThirdCoordinates = ({ position }: { position: string }) => {
		if (position === 'right')
			switch (speakersLength) {
				case 2:
					return [CONFIG.width - 140, CONFIG.width / 2 - 130]
				case 3:
					// TODO: calculate the coordinates for 3 people
					return [665, 355, 45]
				default:
					return [CONFIG.width - 170]
			}
		if (position === 'left')
			switch (speakersLength) {
				case 2:
					return [140, CONFIG.width / 2 - 130]
				case 3:
					// TODO: calculate the coordinates for 3 people
					return [665, 355, 45]
				default:
					return [90]
			}
		else return []
	}
	switch (theme.name) {
		case 'DarkGradient':
			return (
				<>
					<GlassyLowerThirds
						x={
							!isShorts
								? lowerThirdCoordinates({ position: 'right' })[0]
								: SHORTS_CONFIG.width - 80
						}
						y={!isShorts ? 450 : 620}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						branding={branding}
						setTopLayerChildren={setTopLayerChildren}
						isShorts={isShorts}
					/>
					{/* {users &&
            users?.map((user, index) => (
              <GlassyLowerThirds
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                x={lowerThirdCoordinates({ position: 'right' })[index + 1]}
                y={!isShorts ? 450 : 620}
                userName={participants?.[user.uid]?.displayName || ''}
                designation={participants?.[user.uid]?.designation || ''}
                organization={participants?.[user.uid]?.organization || ''}
                logo={branding?.logo || ''}
                color={branding?.background?.color?.primary || ''}
                textColor={branding?.colors?.text || ''}
                branding={branding}
                isShorts={isShorts}
                setTopLayerChildren={setTopLayerChildren}
              />
            ))} */}
				</>
			)
		case 'PastelLines':
			return (
				<>
					<PastelLinesLowerThirds
						x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
						y={!isShorts ? 400 : 560}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						setTopLayerChildren={setTopLayerChildren}
					/>
					{/* {users &&
            users?.map((user, index) => (
              <PastelLinesLowerThirds
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
                y={!isShorts ? 400 : 560}
                userName={participants?.[user.uid]?.displayName || ''}
                designation={lowerThirdUserDesignation || ''}
                organization={lowerThirdUserOrganization || ''}
                logo={branding?.logo || ''}
                color={branding?.background?.color?.primary || ''}
                textColor={branding?.colors?.text || ''}
                setTopLayerChildren={setTopLayerChildren}
              />
            ))} */}
				</>
			)
		case 'Cassidoo': {
			return (
				<>
					<CassidooLowerThirds
						x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
						y={!isShorts ? 400 : 560}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						setTopLayerChildren={setTopLayerChildren}
					/>
					{/* {users.map((user, index) => (
            <CassidooLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
				</>
			)
		}
		case 'LambdaTest': {
			return (
				<>
					<LambdaTestLowerThirds
						x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
						y={!isShorts ? 400 : 560}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						setTopLayerChildren={setTopLayerChildren}
					/>
					{/* {users.map((user, index) => (
            <LambdaTestLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
				</>
			)
		}
		case 'LeeRob': {
			return (
				<>
					<LeeRobLowerThirds
						x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
						y={!isShorts ? 400 : 560}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						setTopLayerChildren={setTopLayerChildren}
					/>
					{/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
				</>
			)
		}
		case 'Web3Auth': {
			return (
				<>
					<Web3AuthLowerThirds
						x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
						y={!isShorts ? 400 : 560}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						setTopLayerChildren={setTopLayerChildren}
					/>
					{/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
				</>
			)
		}
		case 'DevsForUkraine': {
			return (
				<>
					<DevsForUkraineLowerThirds
						x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
						y={!isShorts ? 400 : 560}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						setTopLayerChildren={setTopLayerChildren}
					/>
					{/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
				</>
			)
		}
		case 'Whitep4nth3r': {
			return (
				<>
					<Whitep4nth3rLowerThirds
						x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
						y={!isShorts ? 430 : 600}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						setTopLayerChildren={setTopLayerChildren}
					/>
					{/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
				</>
			)
		}
		case 'VetsWhoCode': {
			return (
				<>
					<VetsWhoCodeLowerThirds
						x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
						y={!isShorts ? 390 : 600}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						// logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						setTopLayerChildren={setTopLayerChildren}
					/>
					{/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
				</>
			)
		}
		case 'ShrutiKapoor':
			return (
				<>
					<ShrutiKapoorLowerThirds
						x={!isShorts ? CONFIG.width - 56 : SHORTS_CONFIG.width - 16}
						y={!isShorts ? 500 : 650}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						branding={branding}
						setTopLayerChildren={setTopLayerChildren}
						isShorts={isShorts}
					/>
					{/* {users &&
            users?.map((user, index) => (
              <GlassyLowerThirds
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                x={lowerThirdCoordinates({ position: 'right' })[index + 1]}
                y={!isShorts ? 450 : 620}
                userName={participants?.[user.uid]?.displayName || ''}
                designation={participants?.[user.uid]?.designation || ''}
                organization={participants?.[user.uid]?.organization || ''}
                logo={branding?.logo || ''}
                color={branding?.background?.color?.primary || ''}
                textColor={branding?.colors?.text || ''}
                branding={branding}
                isShorts={isShorts}
                setTopLayerChildren={setTopLayerChildren}
              />
            ))} */}
				</>
			)
		case 'Mux': {
			return (
				<>
					<MuxLowerThirds
						x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 25}
						y={!isShorts ? 390 : 600}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						setTopLayerChildren={setTopLayerChildren}
					/>
					{/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
				</>
			)
		}
		case 'WunderGraph': {
			return (
				<>
					<WunderGraphLowerThirds
						x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
						y={!isShorts ? 400 : 560}
						userName={lowerThirdUserName || ''}
						designation={lowerThirdUserDesignation || ''}
						organization={lowerThirdUserOrganization || ''}
						logo={branding?.logo || ''}
						color={branding?.background?.color?.primary || ''}
						textColor={branding?.colors?.text || ''}
						setTopLayerChildren={setTopLayerChildren}
					/>
					{/* {users.map((user, index) => (
            <LambdaTestLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
				</>
			)
		}
		default:
			return null
	}
}

export default LowerThridProvider
