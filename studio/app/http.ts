// One response boundary for JSON requests and media uploads. Never retry a
// mutation automatically: a lost response does not mean the write failed.
export const requestJson = async <T>(
  url: string,
  options?: RequestInit
): Promise<T> => {
  const controller =
    (options?.method || 'GET').toUpperCase() === 'GET' && !options?.signal
      ? new AbortController()
      : null
  const timer = controller ? setTimeout(() => controller.abort(), 30000) : null
  try {
    let response: Response
    try {
      response = await fetch(
        url,
        controller ? { ...options, signal: controller.signal } : options
      )
    } catch {
      if (controller?.signal.aborted)
        throw new Error(
          'Loading took too long. Try again; your saved work is kept.'
        )
      throw new Error(
        'Studio is unavailable. Check that it is running, then try again.'
      )
    }
    const result: unknown = await response.json().catch(() => null)
    if (controller?.signal.aborted)
      throw new Error(
        'Loading took too long. Try again; your saved work is kept.'
      )
    if (!response.ok) {
      const message =
        result && typeof result === 'object' && 'error' in result
          ? result.error
          : null
      throw new Error(
        typeof message === 'string' && message.trim()
          ? message
          : response.status >= 500
            ? 'Studio could not complete this request. Try again when it is ready.'
            : 'This request could not be completed. Check your input and try again.'
      )
    }
    if (result === null)
      throw new Error('Studio returned an incomplete response. Try again.')
    return result as T
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}
