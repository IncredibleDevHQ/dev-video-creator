export type SketchFiles = Record<
  string,
  string | { base64: string; contentType: string }
>
