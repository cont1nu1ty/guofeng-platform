import { computed, ref } from 'vue'
import { isMediaRecord, type LocalMediaRecord } from '../domain/localMedia'
const key = 'jiafeng:local-media:v1'
export const localMediaError = ref(false)
function read(): LocalMediaRecord[] {
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return []
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(value) || !value.every(isMediaRecord)) throw new Error('invalid')
    return value
  } catch {
    localMediaError.value = true
    return []
  }
}
const records = ref(read())
const sessionFiles = new Map<string, string>()
export const recitationRecords = computed(() =>
  records.value.filter((item) => item.kind === 'recitation'),
)
export const videoSubmissionRecords = computed(() =>
  records.value.filter((item) => item.kind === 'video'),
)
function write(next: LocalMediaRecord[]) {
  if (localMediaError.value) throw new Error('unavailable')
  uni.setStorageSync(key, JSON.stringify(next))
  records.value = next
}
export function saveLocalMedia(input: Omit<LocalMediaRecord, 'id' | 'createdAt'>, path: string) {
  const record = {
    ...input,
    id: `LOCAL-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  if (!isMediaRecord(record)) throw new Error('invalid')
  const next = [record, ...records.value].slice(0, 100)
  write(next)
  for (const [id, path] of sessionFiles) {
    if (!next.some((item) => item.id === id)) {
      releasePath(path)
      sessionFiles.delete(id)
    }
  }
  sessionFiles.set(record.id, path)
  return record
}
function releasePath(path: string) {
  // #ifdef H5
  if (path.startsWith('blob:')) URL.revokeObjectURL(path)
  // #endif
}
export function removeLocalMedia(id: string) {
  write(records.value.filter((item) => item.id !== id))
  const path = sessionFiles.get(id)
  if (path) releasePath(path)
  sessionFiles.delete(id)
}
export function localMediaPath(id: string) {
  return sessionFiles.get(id) ?? ''
}
