import { describe, it, expect } from 'vitest'
import { wrapCertificateText, certificateFilename } from '../src/domain/certificateLayout'
describe('certificate export content', () => {
  it('wraps long bilingual titles without losing characters', () => {
    const value = '一封给未来的家书 A letter for our family 2026'
    const lines = wrapCertificateText(value, 60, (text) => [...text].length * 10)
    expect(lines.join('')).toBe(value)
    expect(lines.every((line) => [...line].length <= 6)).toBe(true)
  })
  it('retains intentional paragraph breaks and safe filenames', () => {
    expect(wrapCertificateText('第一行\nSecond line', 500, (value) => value.length)).toEqual([
      '第一行',
      'Second line',
    ])
    expect(certificateFilename('course:integrity-home')).toBe(
      'jiafeng-demo-course-integrity-home.png',
    )
  })
})
