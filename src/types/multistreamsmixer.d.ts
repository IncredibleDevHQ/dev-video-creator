declare module 'multistreamsmixer' {
  export default class MultiStreamsMixer {
    constructor(arrayOfMediaStreams: any, elementClass?: any)

    disableLogs: boolean

    frameInterval: number

    width: number

    height: number

    useGainNode: boolean

    startDrawingFrames: () => void

    appendStreams: (streams: any) => void

    releaseStreams: () => void

    resetVideoStreams: (streams: any) => void

    name: string

    toString: () => string

    getMixedStream: () => MediaStream
  }
}
