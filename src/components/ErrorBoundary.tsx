import React from 'react'
import * as Sentry from '@sentry/react'
import { ScreenState } from '.'
import IDError from '../utils/IDError'

class ErrorBoundary extends React.Component<
  Record<string, unknown>,
  { hasError: boolean; error?: Error | IDError }
> {
  constructor(props: Record<string, unknown>) {
    super(props)
    this.state = { hasError: false, error: undefined }
  }

  static getDerivedStateFromError(error: Error | IDError) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error }
  }

  componentDidCatch(error: Error | IDError) {
    // You can also log the error to an error reporting service
    Sentry.captureException(error)
  }

  render() {
    const { hasError, error } = this.state
    const { children } = this.props

    if (hasError) {
      // You can render any custom fallback UI
      // @ts-ignore
      const title = error.title || 'Something went wrong.'
      return (
        <ScreenState
          title={title}
          subtitle={error?.message || 'Something went wrong'}
          button="Reload this page"
          handleClick={() => window.location.reload()}
        />
      )
    }

    return children
  }
}

export default ErrorBoundary
