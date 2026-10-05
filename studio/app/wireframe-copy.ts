/** Display older engine status messages using the product's current terminology. */
export const wireframeStatus = (message: string) =>
  message.replace(/\b(presentations?|slides?)\b/gi, (word) => {
    const replacement = word.toLowerCase().endsWith('s')
      ? 'wireframes'
      : 'wireframe'
    return word[0] === word[0].toUpperCase()
      ? replacement[0].toUpperCase() + replacement.slice(1)
      : replacement
  })
