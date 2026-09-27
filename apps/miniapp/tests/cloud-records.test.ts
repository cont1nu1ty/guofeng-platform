import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateFamilyPromise } from '../src/domain/cloudRecords'

type Call = { url: string; data: any; success: (response: unknown) => void; fail: () => void }
let calls: Call[]
let handle: (call: Call) => void
const respond = (call: Call, data: unknown, statusCode = 200) =>
  call.success({ data, statusCode, header: {} })
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_DATA_MODE', 'http')
  vi.stubEnv('VITE_API_BASE_URL', 'https://pilot.example/api/v1')
  calls = []
  handle = (call) => respond(call, { workspace: {} })
  vi.stubGlobal('uni', {
    getStorageSync: () => '',
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    request: (call: Call) => {
      calls.push(call)
      handle(call)
    },
    uploadFile: (call: Call) => {
      calls.push(call)
      handle(call)
    },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe('personal record contracts and account isolation', () => {
  it('sends an encoded standalone public search request without refreshing workspace', async () => {
    const { searchRemote } = await import('../src/services/search')
    handle = (call) => respond(call, { items: [], total: 0, counts: { all: 0 }, nextCursor: null })
    const result = await searchRemote({
      q: '家风 & trust',
      kind: 'all',
      region: 'zhejiang',
      language: 'en',
      cursor: 'opaque+cursor',
    })
    const url = new URL(calls[0]!.url)
    expect(url.pathname).toBe('/api/v1/search')
    expect(url.searchParams.get('q')).toBe('家风 & trust')
    expect(url.searchParams.get('cursor')).toBe('opaque+cursor')
    expect(url.searchParams.get('pageSize')).toBe('12')
    expect(result.items).toEqual([])
    expect(calls).toHaveLength(1)
  })
  it('uses create-only version zero for a new promise and the loaded version for edits', async () => {
    const records = await import('../src/services/cloudRecords')
    await records.saveFamilyPromise('person-one', '  每周和家人共读家书  ')
    await records.saveFamilyPromise('person-one', '每天认真倾听家人的话', {
      id: 'promise-one',
      lockVersion: 7,
    })
    expect(calls[0]?.data).toEqual({
      command: 'familyPromise.save',
      entityId: undefined,
      data: { personId: 'person-one', text: '每周和家人共读家书' },
      version: 0,
    })
    expect(calls[1]?.data.version).toBe(7)
    expect(calls[1]?.data.entityId).toBe('promise-one')
  })
  it('keeps local text untouched on a concurrent edit and exposes the conflict', async () => {
    handle = (call) => respond(call, { code: 'VERSION_CONFLICT', message: '已在另一设备修改' }, 409)
    const records = await import('../src/services/cloudRecords')
    await expect(
      records.saveFamilyPromise('p', '保留本次输入的家庭约定', { id: 'x', lockVersion: 1 }),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 })
    expect(uni.setStorageSync).not.toHaveBeenCalled()
  })
  it('saves only an uploaded file id and explicit consent, and deletes using a record version', async () => {
    const records = await import('../src/services/cloudRecords')
    await records.saveRecitation(' 今天的家书 ', 'private-file')
    await records.removeRecitation({ id: 'r', lockVersion: 3 } as any)
    expect(calls[0]?.data.data).toEqual({
      title: '今天的家书',
      fileId: 'private-file',
      consent: true,
    })
    expect(calls[1]?.data).toEqual({
      command: 'recitation.remove',
      entityId: 'r',
      data: undefined,
      version: 3,
    })
  })
  it('clears both private lists on account logout without importing device data', async () => {
    const api = await import('../src/services/api')
    api.applyWorkspace({ recitations: [{ id: 'r' }] as any, familyPromises: [{ id: 'p' }] as any })
    await api.signOutRemote()
    expect(api.remoteWorkspace.recitations).toEqual([])
    expect(api.remoteWorkspace.familyPromises).toEqual([])
    expect(uni.setStorageSync).not.toHaveBeenCalled()
  })
  it('discards an authorized audio URL returned after the account changed', async () => {
    const api = await import('../src/services/api')
    const records = await import('../src/services/cloudRecords')
    let pending: Call | undefined
    handle = (call) => (call.url.includes('/files/') ? (pending = call) : respond(call, {}))
    const url = records.recitationUrl('private-file')
    await api.signOutRemote()
    respond(pending!, { url: 'https://private.example/signed' })
    await expect(url).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
  })
  it('uploads recordings with their dedicated purpose and retains normalized server metadata', async () => {
    const api = await import('../src/services/api')
    handle = (call) =>
      call.url.includes('/auth/login')
        ? respond(call, { token: 'session', user: { id: 'u' } })
        : respond(call, {})
    await api.signInRemote('demo', 'pass')
    handle = (call) =>
      respond(
        call,
        JSON.stringify({
          fileId: 'f',
          name: '给家人的信.mp3',
          type: 'audio',
          size: 100,
          duration: 2.5,
          purpose: 'recitation',
        }),
      )
    const file = await api.uploadRemoteFile('/tmp/record.webm', '给家人的信.webm', 'recitation')
    expect(calls.at(-1)?.url).toBe('https://pilot.example/api/v1/files?purpose=recitation')
    expect(file).toMatchObject({ name: '给家人的信.mp3', duration: 2.5, fileId: 'f' })
  })
  it('validates trimmed family promise limits by Unicode characters', () => {
    expect(validateFamilyPromise(' 三个字 ')).toBe(false)
    expect(validateFamilyPromise('认真听家人说话')).toBe(true)
    expect(validateFamilyPromise('家'.repeat(181))).toBe(false)
    expect(validateFamilyPromise('𠮷'.repeat(180))).toBe(true)
  })
})
