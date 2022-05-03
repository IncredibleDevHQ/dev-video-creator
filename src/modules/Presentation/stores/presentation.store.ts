import { atom } from 'recoil'
import { ThemeFragment } from '../../../generated/graphql'
import { CodeTheme, BrandingJSON, ViewConfig } from '../utils/configTypes'

export interface StaticAssets {
  shortsBackgroundMusic: string
}
export interface PresentationProviderProps<T = any, S = any> {
  fragmentId: string
  flickName: string
  ownerName: string
  ownerDesignation: string
  ownerOrganization: string

  branding?: BrandingJSON | null
  theme: ThemeFragment

  dataConfig: any
  viewConfig: ViewConfig

  payload: any
  setPayload: (payload: any) => void

  codePayload: any
  setCodePayload: (payload: any) => void

  listPayload: any
  setListPayload: (payload: any) => void

  videoPayload: any
  setVideoPayload: (payload: any) => void

  // introPayload: any;
  // setIntroPayload: (payload: any) => void;

  // outroPayload: any;
  // setOutroPayload: (payload: any) => void;

  // config to render controls
  controlsConfig?: any
  shortsMode?: boolean

  staticAssets?: StaticAssets

  preloadedBlobUrls?: {
    [key: string]: string | undefined
  }

  codes?: {
    [key: string]: {
      code: string | undefined
      colorCode: any
      theme: CodeTheme
    }
  }
}

const presentationStore = atom<PresentationProviderProps>({
  key: 'presentation',
  default: {
    theme: {
      name: 'DarkGradient',
      config: {},
    },
    codePayload: {
      currentIndex: 0,
      prevIndex: -1,
      focusBlockCode: false,
      activeBlockIndex: 0,
      isFocus: false,
    },
    listPayload: {
      activePointIndex: 0,
    },
    videoPayload: {
      currentTime: 0,
      playing: false,
    },
    // introPayload: {
    // 	activeIntroIndex: 0,
    // },
    // outroPayload: {
    // 	activeOutroIndex: 0,
    // },
    payload: {
      activeObjectIndex: 0,
      fragmentState: 'customLayout',
    },
  } as PresentationProviderProps,
  dangerouslyAllowMutability: true,
})

export default presentationStore
