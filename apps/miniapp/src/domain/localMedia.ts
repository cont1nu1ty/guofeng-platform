export interface LocalMediaRecord {
  id: string
  kind: 'recitation' | 'video'
  title: string
  category: string
  fileName: string
  size: number
  duration: number
  createdAt: string
}
export interface LocalMediaFile {
  name: string
  size: number
  path: string
  duration?: number
}
export const audioExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm']
export const videoExtensions = ['mp4', 'mov', 'webm']
export function validateMediaFile(
  file: LocalMediaFile,
  kind: LocalMediaRecord['kind'],
): 'format' | 'size' | 'duration' | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (!(kind === 'video' ? videoExtensions : audioExtensions).includes(ext)) return 'format'
  if (
    !Number.isFinite(file.size) ||
    file.size <= 0 ||
    file.size > (kind === 'video' ? 50 : 10) * 1024 * 1024
  )
    return 'size'
  if (
    file.duration &&
    (!Number.isFinite(file.duration) || file.duration > (kind === 'video' ? 600 : 180))
  )
    return 'duration'
  return null
}
export function isMediaRecord(value: unknown): value is LocalMediaRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<LocalMediaRecord>
  return (
    typeof item.id === 'string' &&
    ['recitation', 'video'].includes(item.kind ?? '') &&
    typeof item.title === 'string' &&
    typeof item.category === 'string' &&
    typeof item.fileName === 'string' &&
    typeof item.size === 'number' &&
    Number.isFinite(item.size) &&
    item.size > 0 &&
    typeof item.duration === 'number' &&
    Number.isFinite(item.duration) &&
    item.duration >= 0 &&
    typeof item.createdAt === 'string'
  )
}
