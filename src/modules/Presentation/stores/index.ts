import presentationStore, {
  controlsConfigStore,
  PresentationProviderProps,
} from './presentation.store'
import canvasStore, { CanvasProviderProps } from './canvas.store'

export { canvasStore, presentationStore, controlsConfigStore as controlsConfig }
export type { CanvasProviderProps, PresentationProviderProps }
