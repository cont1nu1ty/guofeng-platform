import { describe, it, expect } from 'vitest'
import { createAccountDemo, ACCOUNT_KEY } from '../src/domain/accountDemo'
const form = {
  displayName: 'Demo companion',
  affiliation: 'Fictional reading group',
  category: 'individual' as const,
  consent: true,
}
function fixture() {
  const data = new Map<string, string>()
  let fail = false
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (fail) throw new Error('quota')
      data.set(key, value)
    },
  }
  return {
    data,
    storage,
    store: createAccountDemo(storage, () => '2026-09-21T00:00:00.000Z'),
    fail: () => {
      fail = true
    },
  }
}
describe('local account demonstration', () => {
  it('requires explicit consent and sign-in before sample verification', () => {
    const { store } = fixture()
    expect(() => store.signIn(false)).toThrow('consent')
    expect(() => store.submit(form)).toThrow('sign_in')
    store.signIn(true)
    expect(() => store.submit({ ...form, consent: false })).toThrow('consent')
    expect(store.getState().verification.status).toBe('unverified')
  })
  it('supports reject, resubmit and approve and retains records after sign-out', () => {
    const { store, storage } = fixture()
    store.signIn(true)
    store.submit(form)
    expect(store.getState().verification.status).toBe('pending')
    store.review('rejected')
    expect(store.getState().verification.status).toBe('rejected')
    store.submit({ ...form, affiliation: 'New fictional group' })
    store.review('approved')
    store.signOut()
    const saved = createAccountDemo(storage).getState()
    expect(saved.signedIn).toBe(false)
    expect(saved.verification.status).toBe('approved')
    expect(saved.verification.form?.affiliation).toBe('New fictional group')
    store.signIn(true)
    store.resetVerification()
    expect(store.getState().verification.status).toBe('unverified')
  })
  it('never advances state on failed storage writes', () => {
    const { store, fail } = fixture()
    store.signIn(true)
    store.submit(form)
    const before = store.getState()
    fail()
    expect(() => store.review('approved')).toThrow('storage')
    expect(() => store.signOut()).toThrow('storage')
    expect(() => store.resetVerification()).toThrow('storage')
    expect(store.getState()).toEqual(before)
  })
  it('blocks duplicate pending submissions and invalid transitions', () => {
    const { store } = fixture()
    store.signIn(true)
    expect(() => store.review('approved')).toThrow('review')
    store.submit(form)
    expect(() => store.submit(form)).toThrow('pending')
    store.review('rejected')
    expect(() => store.review('approved')).toThrow('review')
  })
  it('rejects empty or phone-like sample details and isolates returned copies', () => {
    const { store } = fixture()
    store.signIn(true)
    expect(() => store.submit({ ...form, displayName: '12345678901' })).toThrow('name')
    expect(() => store.submit({ ...form, affiliation: '' })).toThrow('affiliation')
    store.submit(form)
    const copy = store.getState()
    copy.verification.form!.displayName = 'Changed'
    expect(store.getState().verification.form?.displayName).toBe(form.displayName)
  })
  it('preserves corrupt account storage without silently resetting', () => {
    const { data, storage } = fixture()
    data.set(ACCOUNT_KEY, '{invalid')
    expect(() => createAccountDemo(storage)).toThrow('format')
    expect(data.get(ACCOUNT_KEY)).toBe('{invalid')
  })
})
