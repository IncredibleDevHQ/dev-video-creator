export const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!))
export const button = (label: string, action: string, primary = false, disabled = false) => `<button type="button" data-action="${action}" ${primary ? 'class="primary"' : ''} ${disabled ? 'disabled' : ''}>${label}</button>`
