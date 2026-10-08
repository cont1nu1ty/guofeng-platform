export interface CaptionCue {
  startMs: number
  endMs: number
  text: string
}
export interface MediaAccessibility {
  language?: 'zh' | 'en'
  cues: CaptionCue[]
  narrationUrl: string
  publishedAt?: string
}
export function activeCaption(cues: CaptionCue[], seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  const time = seconds * 1000
  return cues.find((cue) => time >= cue.startMs && time < cue.endMs)?.text || ''
}
