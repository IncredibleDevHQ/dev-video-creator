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
  play(): void
  pause(): void
  seek(time: number): void
}
