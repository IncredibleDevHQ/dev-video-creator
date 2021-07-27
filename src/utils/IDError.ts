class IDError extends Error {
  title?: string

  constructor(message: string, title?: string) {
    super()

    this.title = title
    this.message = message
  }
}

export default IDError
