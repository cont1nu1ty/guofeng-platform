import { ref } from 'vue'
import type { AttachmentMeta } from '../domain/types'
import { t } from './useLocale'

export const MAX_ATTACHMENT_COUNT = 5
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const temporaryPaths = ref<Record<string, string>>({})
let sequence = 0
interface PickedFile {
  name?: string
  size?: number
  path?: string
  type?: string
}
type PickerMode = 'image' | 'document'

export function attachmentPreviewPath(id: string) {
  return temporaryPaths.value[id] ?? ''
}
export function attachmentSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(bytes / 1024))} KB`
}
function releasePath(id: string) {
  const path = temporaryPaths.value[id]
  // #ifdef H5
  if (path?.startsWith('blob:')) URL.revokeObjectURL(path)
  // #endif
  delete temporaryPaths.value[id]
}
function pickFiles(mode: PickerMode, count: number): Promise<PickedFile[]> {
  return new Promise((resolve, reject) => {
    const success = (result: { tempFiles?: unknown }) => {
      const files = Array.isArray(result.tempFiles)
        ? result.tempFiles
        : result.tempFiles
          ? [result.tempFiles]
          : []
      resolve(files.filter((file): file is PickedFile => typeof file === 'object' && file !== null))
    }
    if (mode === 'image') {
      uni.chooseImage({
        count,
        sourceType: ['album', 'camera'],
        sizeType: ['original'],
        success,
        fail: reject,
      })
      return
    }
    // #ifdef H5
    uni.chooseFile({
      count,
      type: 'all',
      extension: ['.pdf', '.doc', '.docx'],
      success,
      fail: reject,
    })
    return
    // #endif
    // #ifdef MP-WEIXIN
    uni.chooseMessageFile({
      count,
      type: 'file',
      extension: ['pdf', 'doc', 'docx'],
      success,
      fail: reject,
    })
    return
    // #endif
    // #ifndef H5
    // #ifndef MP-WEIXIN
    reject(
      new Error(
        t(
          '当前端暂不支持文档选择，请在 H5 或微信体验。',
          'Document selection is available in the web and WeChat previews.',
        ),
      ),
    )
    // #endif
    // #endif
  })
}
function kindOf(file: PickedFile, mode: PickerMode): AttachmentMeta['type'] | undefined {
  const suffix = (file.name ?? file.path ?? '').split('?')[0]?.split('.').pop()?.toLowerCase()
  if (mode === 'document')
    return suffix === 'pdf' ? 'pdf' : suffix === 'doc' || suffix === 'docx' ? 'word' : undefined
  if (
    file.type?.startsWith('image/') &&
    !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
  )
    return undefined
  if (
    ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(suffix ?? '') ||
    file.type?.startsWith('image/')
  )
    return 'image'
  // Native chooseImage may return an opaque temporary path without a filename.
  if (!file.name && (!file.type || file.type === 'image')) return 'image'
  return undefined
}
export function useSubmissionAttachments() {
  const picking = ref(false)
  const attachmentErrors = ref<string[]>([])
  async function selectAttachments(
    mode: PickerMode,
    current: AttachmentMeta[],
    replaceId?: string,
  ): Promise<AttachmentMeta[] | undefined> {
    if (picking.value) return
    attachmentErrors.value = []
    const remaining = replaceId ? 1 : MAX_ATTACHMENT_COUNT - current.length
    if (remaining <= 0) {
      attachmentErrors.value = [
        t(
          '最多添加 5 个附件，请先移除一个。',
          'You can add up to 5 attachments. Remove one first.',
        ),
      ]
      return
    }
    picking.value = true
    try {
      const files = await pickFiles(mode, remaining)
      const next = [...current]
      for (const file of files) {
        const name = file.name?.trim() || `${t('手稿图片', 'Manuscript image')}-${Date.now()}.jpg`
        const kind = kindOf(file, mode)
        if (!kind) {
          attachmentErrors.value.push(
            t(
              `${name}：不支持此格式，请选择 JPG/PNG/WebP/GIF 图片或 PDF/Word 文件。`,
              `${name}: unsupported format. Choose JPG/PNG/WebP/GIF images or PDF/Word documents.`,
            ),
          )
          continue
        }
        if (!Number.isFinite(file.size) || !file.size || file.size <= 0) {
          attachmentErrors.value.push(
            t(
              `${name}：文件为空或无法读取大小。`,
              `${name}: the file is empty or its size cannot be read.`,
            ),
          )
          continue
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          attachmentErrors.value.push(
            t(
              `${name}：超过单个附件 10 MB 的限制。`,
              `${name}: exceeds the 10 MB limit per attachment.`,
            ),
          )
          continue
        }
        if (typeof file.path !== 'string' || !file.path) {
          attachmentErrors.value.push(
            t(
              `${name}：无法读取本机文件，请重新选择。`,
              `${name}: the local file could not be read. Select it again.`,
            ),
          )
          continue
        }
        const id = replaceId ?? `attachment-${Date.now().toString(36)}-${++sequence}`
        const metadata: AttachmentMeta = {
          id,
          name: name.slice(0, 200),
          size: file.size,
          type: kind,
        }
        if (file.type?.includes('/')) metadata.mimeType = file.type
        if (replaceId) {
          const index = next.findIndex((item) => item.id === replaceId)
          if (index < 0) continue
          releasePath(replaceId)
          next[index] = metadata
        } else if (next.length < MAX_ATTACHMENT_COUNT) next.push(metadata)
        else {
          attachmentErrors.value.push(
            t(
              '最多添加 5 个附件，超出部分未添加。',
              'Only 5 attachments are allowed. Additional files were not added.',
            ),
          )
          continue
        }
        temporaryPaths.value[id] = file.path
      }
      return next
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'errMsg' in error
          ? String(error.errMsg)
          : error instanceof Error
            ? error.message
            : ''
      if (!message.toLowerCase().includes('cancel'))
        attachmentErrors.value = [
          t(
            '文件选择未完成，请检查权限后重试。',
            'File selection failed. Check permissions and try again.',
          ),
        ]
    } finally {
      picking.value = false
    }
  }
  function removeAttachment(id: string, current: AttachmentMeta[]) {
    releasePath(id)
    return current.filter((item) => item.id !== id)
  }
  function markPreviewUnavailable(id: string) {
    releasePath(id)
    attachmentErrors.value = [
      t(
        '此图片的临时预览已失效，请重新选择文件。',
        'The temporary image preview is unavailable. Select the file again.',
      ),
    ]
  }
  return { picking, attachmentErrors, selectAttachments, removeAttachment, markPreviewUnavailable }
}
