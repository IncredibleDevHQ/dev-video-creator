// The parts of the ws package the voice relay uses: it ships no types.
declare module 'ws' {
  import type { IncomingMessage } from 'node:http'
  import type { Duplex } from 'node:stream'
  type RawData = Buffer | ArrayBuffer | Buffer[]
  export class WebSocket {
    static readonly CONNECTING: 0
    static readonly OPEN: 1
    static readonly CLOSING: 2
    static readonly CLOSED: 3
    readonly readyState: number
    constructor(
      address: string,
      options?: { headers?: Record<string, string>; maxPayload?: number }
    )
    send(data: string | Buffer | Uint8Array): void
    close(code?: number, reason?: string): void
    terminate(): void
    on(event: 'open', listener: () => void): this
    on(
      event: 'message',
      listener: (data: RawData, isBinary: boolean) => void
    ): this
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this
    on(event: 'error', listener: (error: Error) => void): this
    on(
      event: 'unexpected-response',
      listener: (
        request: { destroy(): void },
        response: IncomingMessage
      ) => void
    ): this
    once(event: 'open', listener: () => void): this
    once(event: 'close', listener: () => void): this
  }
  export class WebSocketServer {
    constructor(options: {
      noServer?: boolean
      port?: number
      host?: string
      maxPayload?: number
    })
    handleUpgrade(
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (socket: WebSocket, request: IncomingMessage) => void
    ): void
    readonly clients: Set<WebSocket>
    close(callback?: () => void): void
    address(): { port: number } | string | null
    on(
      event: 'connection',
      listener: (socket: WebSocket, request: IncomingMessage) => void
    ): this
    on(event: 'listening', listener: () => void): this
  }
}
