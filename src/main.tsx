import React from 'react'
import ReactDOM from 'react-dom'
import * as Sentry from '@sentry/react'
import { Integrations } from '@sentry/tracing'
import './index.css'
import * as snippet from '@segment/snippet'
import App from './App'
import config from './config'

if (config.sentry.enabled)
  Sentry.init({
    dsn: config.sentry.dsn,
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: 1.0,
  })

// append script tag to dom
const script = document.createElement('script')
const segmentSnippet = snippet.max({
  apiKey: config.segment.apiKey?.toString(),
})
script.innerHTML = segmentSnippet
document.head.appendChild(script)

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
)
