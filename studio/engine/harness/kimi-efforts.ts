import { isReasoningEffort } from '../../shared/reasoning-effort'
export const kimiEfforts = (config: string, model: string) => {
  const sections = new Map<string, string>()
  let name = ''
  for (const line of config.split('\n')) {
    const header = /^\s*\[(.+)\]\s*$/.exec(line)
    if (header) name = header[1]
    else sections.set(name, (sections.get(name) || '') + '\n' + line)
  }
  const base =
    sections.get(`models."${model}"`) || sections.get(`models.${model}`) || ''
  const override =
    sections.get(`models."${model}".overrides`) ||
    sections.get(`models.${model}.overrides`) ||
    ''
  const pattern = /^\s*support_efforts\s*=\s*\[([^\]]*)\]/m
  const list = pattern.exec(override)?.[1] ?? pattern.exec(base)?.[1]
  return list
    ?.split(',')
    .map((value) => value.trim().replace(/^["']|["']$/g, ''))
    .filter(isReasoningEffort)
}
