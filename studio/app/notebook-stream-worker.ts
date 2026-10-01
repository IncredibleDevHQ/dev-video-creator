import { NotebookStreams } from './notebook-stream'
const streams = new NotebookStreams()
const worker = self as unknown as { onconnect: (event: MessageEvent) => void }
worker.onconnect = (event) => {
  const port = event.ports[0]
  port.onmessage = ({ data }) => {
    if (data?.type === 'watch' && typeof data.id === 'string')
      streams.watch(port, data.id)
    else if (data?.type === 'stop') streams.unwatch(port)
    else if (data?.type === 'ping') streams.touch(port)
  }
  port.start()
}
setInterval(() => streams.expire(), 30000)
