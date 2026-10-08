import { describe, it, expect } from 'vitest'
import { activeCaption } from '../src/pkg-content/domain/mediaAccessibility'
describe('published caption playback', () => {
  const cues = [
    { startMs: 1000, endMs: 2000, text: 'First' },
    { startMs: 2000, endMs: 3000, text: 'Second' },
  ]
  it('uses half-open timing and does not repeat a caption across a gap or after the end', () => {
    expect(activeCaption(cues, 0.5)).toBe('')
    expect(activeCaption(cues, 1)).toBe('First')
    expect(activeCaption(cues, 2)).toBe('Second')
    expect(activeCaption(cues, 3)).toBe('')
  })
  it('does not display captions for malformed playback events', () => {
    expect(activeCaption(cues, Number.NaN)).toBe('')
    expect(activeCaption(cues, -1)).toBe('')
  })
})
