declare namespace JSX {
  interface IntrinsicElements {
    'hyperframes-player': Record<string, unknown>
  }
}

interface HyperframesPlayerElement extends HTMLElement {
  iframeElement: HTMLIFrameElement
  currentTime: number
  duration: number
  ready: boolean
  paused: boolean
  muted: boolean
  volume: number
  playbackRate: number
  play(): void
  pause(): void
  seek(time: number): void
}
