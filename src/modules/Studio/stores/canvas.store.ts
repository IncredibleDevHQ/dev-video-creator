import { atom } from 'recoil'

export interface CanvasProviderProps {
  zoomed: boolean
  resetCanvas: () => void
}

const canvasStore = atom<CanvasProviderProps | null>({
  key: 'canvasStore',
  default: null,
})

export default canvasStore
