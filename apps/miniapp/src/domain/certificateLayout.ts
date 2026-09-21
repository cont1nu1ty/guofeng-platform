export interface CertificateData {
  id: string
  title: string
  recipient: string
  subject: string
  date: string
}
export function wrapCertificateText(
  text: string,
  width: number,
  measure: (value: string) => number,
) {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const character of paragraph) {
      if (line && measure(line + character) > width) {
        lines.push(line)
        line = character
      } else line += character
    }
    lines.push(line)
  }
  return lines
}
export function certificateFilename(id: string) {
  return `jiafeng-demo-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}.png`
}
