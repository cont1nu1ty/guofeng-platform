import { describe, expect, it } from 'vitest'
import { allQuestionsAnswered, type PublishedCourse } from '../src/pkg-content/domain/education'
describe('server-graded quiz input', () => {
  const course = {
    questions: [
      {
        id: 'question-1',
        options: [
          { id: 'a', text: '甲' },
          { id: 'b', text: '乙' },
        ],
      },
    ],
  } as PublishedCourse
  it('accepts valid option ids without needing an answer key', () => {
    expect(allQuestionsAnswered(course, { 'question-1': 'b' })).toBe(true)
    expect(allQuestionsAnswered(course, { 'question-1': 'a' })).toBe(true)
  })
  it('rejects missing or stale option ids', () => {
    expect(allQuestionsAnswered(course, {})).toBe(false)
    expect(allQuestionsAnswered(course, { 'question-1': 'stale-option' })).toBe(false)
  })
})
