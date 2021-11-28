import { useEffect } from 'react'
import { useRemirrorContext } from '@remirror/react'

const ContentUpdater = ({ content }: { content: any }) => {
  const { setContent } = useRemirrorContext()

  useEffect(() => {
    setContent(content || '')
  }, [content])

  return null
}

export default ContentUpdater
