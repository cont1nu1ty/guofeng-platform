import type { DemoStorage } from './types'
export const ACCOUNT_KEY = 'jiafeng:account:v1'
export type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected'
export interface VerificationForm {
  displayName: string
  affiliation: string
  category: 'individual' | 'student' | 'overseas'
  consent: boolean
}
export interface AccountState {
  version: 1
  signedIn: boolean
  verification: {
    status: VerificationStatus
    form?: VerificationForm
    submittedAt?: string
    reviewedAt?: string
  }
}
export type AccountErrorCode =
  | 'storage'
  | 'format'
  | 'sign_in'
  | 'consent'
  | 'name'
  | 'affiliation'
  | 'category'
  | 'pending'
  | 'review'
export class AccountError extends Error {
  constructor(public code: AccountErrorCode) {
    super(code)
  }
}
const empty = (): AccountState => ({
  version: 1,
  signedIn: false,
  verification: { status: 'unverified' },
})
function validForm(value: unknown): value is VerificationForm {
  if (!value || typeof value !== 'object') return false
  const v = value as VerificationForm
  return (
    typeof v.displayName === 'string' &&
    typeof v.affiliation === 'string' &&
    ['individual', 'student', 'overseas'].includes(v.category) &&
    typeof v.consent === 'boolean'
  )
}
export function createAccountDemo(storage: DemoStorage, now = () => new Date().toISOString()) {
  let state = empty()
  try {
    const raw = storage.getItem(ACCOUNT_KEY)
    if (raw) {
      const value = JSON.parse(raw) as AccountState
      if (
        !value ||
        value.version !== 1 ||
        typeof value.signedIn !== 'boolean' ||
        !value.verification ||
        !['unverified', 'pending', 'approved', 'rejected'].includes(value.verification.status) ||
        (value.verification.form !== undefined && !validForm(value.verification.form)) ||
        (value.verification.status !== 'unverified' && !value.verification.form) ||
        (value.verification.submittedAt !== undefined &&
          typeof value.verification.submittedAt !== 'string') ||
        (value.verification.reviewedAt !== undefined &&
          typeof value.verification.reviewedAt !== 'string')
      )
        throw new AccountError('format')
      state = value
    }
  } catch (e) {
    throw e instanceof AccountError ? e : new AccountError('format')
  }
  const copy = () => JSON.parse(JSON.stringify(state)) as AccountState
  function save(next: AccountState) {
    try {
      storage.setItem(ACCOUNT_KEY, JSON.stringify(next))
    } catch {
      throw new AccountError('storage')
    }
    state = next
    return copy()
  }
  return {
    getState: copy,
    signIn(consent: boolean) {
      if (!consent) throw new AccountError('consent')
      return save({ ...state, signedIn: true })
    },
    signOut() {
      return save({ ...state, signedIn: false })
    },
    submit(value: VerificationForm) {
      if (!state.signedIn) throw new AccountError('sign_in')
      if (state.verification.status === 'pending') throw new AccountError('pending')
      if (!value.consent) throw new AccountError('consent')
      if (
        value.displayName.trim().length < 2 ||
        value.displayName.trim().length > 30 ||
        /\d{6,}/.test(value.displayName)
      )
        throw new AccountError('name')
      if (
        value.affiliation.trim().length < 2 ||
        value.affiliation.trim().length > 60 ||
        /\d{6,}/.test(value.affiliation)
      )
        throw new AccountError('affiliation')
      if (!['individual', 'student', 'overseas'].includes(value.category))
        throw new AccountError('category')
      const form = {
        ...value,
        displayName: value.displayName.trim(),
        affiliation: value.affiliation.trim(),
      }
      return save({ ...state, verification: { status: 'pending', form, submittedAt: now() } })
    },
    review(outcome: 'approved' | 'rejected') {
      if (!state.signedIn) throw new AccountError('sign_in')
      if (state.verification.status !== 'pending' || !['approved', 'rejected'].includes(outcome))
        throw new AccountError('review')
      return save({
        ...state,
        verification: { ...state.verification, status: outcome, reviewedAt: now() },
      })
    },
    resetVerification() {
      if (!state.signedIn) throw new AccountError('sign_in')
      return save({ ...state, verification: { status: 'unverified' } })
    },
  }
}
