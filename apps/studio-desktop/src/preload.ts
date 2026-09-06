// Minimal typed bridge. The harness port arrives in a later iteration; for
// now the renderer only needs to know it runs inside the desktop shell.
import { contextBridge } from 'electron'

export type StudioDesktopBridge = {
  isDesktop: true
  platform: NodeJS.Platform
  versions: {
    electron: string
    chrome: string
    node: string
  }
}

const bridge: StudioDesktopBridge = {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron || '',
    chrome: process.versions.chrome || '',
    node: process.versions.node || '',
  },
}

contextBridge.exposeInMainWorld('studioDesktop', bridge)
