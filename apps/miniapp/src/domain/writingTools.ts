export interface WritingDelta {
  ops: {
    insert: string
    attributes?: {
      bold?: true
      italic?: true
      underline?: true
      header?: 2 | 3
      list?: 'ordered' | 'bullet'
    }
  }[]
}
/** Keep text and a small formatting vocabulary; embeds, links, style and HTML are never persisted. */
export function cleanWritingDelta(value: unknown, fallback = ''): WritingDelta {
  const ops: WritingDelta['ops'] = []
  let remaining = 10001
  if (value && typeof value === 'object' && 'ops' in value && Array.isArray(value.ops)) {
    for (const candidate of value.ops.slice(0, 20000)) {
      if (!candidate || typeof candidate !== 'object' || typeof candidate.insert !== 'string')
        continue
      const insert = [...candidate.insert].slice(0, remaining).join('')
      if (!insert) continue
      remaining -= [...insert].length
      const attributes: NonNullable<WritingDelta['ops'][number]['attributes']> = {}
      const original = candidate.attributes ?? {}
      for (const name of ['bold', 'italic', 'underline'] as const)
        if (original[name] === true) attributes[name] = true
      if (original.header === 2 || original.header === 3) attributes.header = original.header
      if (original.list === 'ordered' || original.list === 'bullet') attributes.list = original.list
      ops.push(Object.keys(attributes).length ? { insert, attributes } : { insert })
      if (!remaining) break
    }
  }
  if (!ops.length) ops.push({ insert: [...fallback].slice(0, 10000).join('') + '\n' })
  if (!ops[ops.length - 1]!.insert.endsWith('\n')) ops.push({ insert: '\n' })
  return { ops }
}
export const writingText = (delta: WritingDelta) =>
  delta.ops
    .map((op) => op.insert)
    .join('')
    .replace(/\n$/, '')
const escape = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
/** Render only our allowlisted Delta. Never display editor-supplied or stored arbitrary HTML. */
export function writingHtml(value: unknown, fallback = ''): string {
  const delta = cleanWritingDelta(value, fallback)
  let result = '',
    line = ''
  for (const op of delta.ops) {
    const parts = op.insert.split('\n')
    for (let i = 0; i < parts.length; i++) {
      let part = escape(parts[i]!)
      if (op.attributes?.bold) part = `<strong>${part}</strong>`
      if (op.attributes?.italic) part = `<em>${part}</em>`
      if (op.attributes?.underline) part = `<u>${part}</u>`
      line += part
      if (i < parts.length - 1) {
        const tag = op.attributes?.header ? `h${op.attributes.header}` : 'p'
        const prefix =
          op.attributes?.list === 'bullet' ? '• ' : op.attributes?.list === 'ordered' ? '· ' : ''
        result += `<${tag}>${prefix}${line || '<br>'}</${tag}>`
        line = ''
      }
    }
  }
  return result + (line ? `<p>${line}</p>` : '')
}
export function checkPoem(text: string) {
  const lines = text
    .split(/[\n，。！？；,;.!?]+/)
    .map((line) => line.replace(/[\s、：“”‘’"'（）()《》<>]/g, ''))
    .filter(Boolean)
  const counts = lines.map((line) => [...line].length)
  const chinese = lines.every((line) => /^[\u3400-\u9fff\uf900-\ufaff]+$/.test(line))
  const uniform = counts.length > 0 && counts.every((n) => n === counts[0])
  return {
    lines,
    counts,
    chinese,
    uniform,
    pattern:
      chinese && uniform && [5, 7].includes(counts[0]!) && [4, 8].includes(lines.length)
        ? `${counts[0]}×${lines.length}`
        : null,
  }
}
