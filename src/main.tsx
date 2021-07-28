import React from 'react'
import ReactDOM from 'react-dom'
import * as Sentry from '@sentry/react'
import { Integrations } from '@sentry/tracing'
import './index.css'
import App from './App'
import config from './config'

if (config.sentry.enabled)
  Sentry.init({
    dsn: config.sentry.dsn,
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: 1.0,
  })

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
)
