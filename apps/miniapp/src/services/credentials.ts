import { currentSessionEpoch, remoteUser, request } from './api'
import type { Agreement, CertificateRecord, CopyrightConfirmation, CredentialPage, ResourceRecord } from '../domain/credentials'
export const getAgreement = async () => (await request<Agreement>('/rights/agreement')).data
export const getCertificates = async (page = 1) => (await request<CredentialPage<CertificateRecord>>(`/me/certificates?page=${page}&pageSize=10`)).data
export const getConfirmations = async () => (await request<{ items: CopyrightConfirmation[] }>('/me/copyright-confirmations')).data
export const getResources = async (page = 1) => (await request<CredentialPage<ResourceRecord>>(`/resources?page=${page}&pageSize=10`)).data
export function confirmationRequest(submissionId: string, input: { revisionId: string; version: number; agreementVersion: string; accepted: boolean }) {
  const epoch = currentSessionEpoch(), owner = remoteUser.value?.id
  const key = `rights-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const payload = { ...input }
  return async () => {
    if (!owner || owner !== remoteUser.value?.id || epoch !== currentSessionEpoch()) throw new Error('登录状态已变更，请重新核对 / Sign-in changed. Review again.')
    return (await request(`/submissions/${encodeURIComponent(submissionId)}/copyright-confirmations`, 'POST', payload, { 'Idempotency-Key': key })).data
  }
}
async function openAuthorizedFile(url: string, mimeType: string) {
  // #ifdef H5
  const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.click()
  return
  // #endif
  // #ifndef H5
  if (mimeType.startsWith('image/')) { uni.previewImage({ urls: [url] }); return }
  const response = await new Promise<UniApp.DownloadSuccessData>((resolve, reject) => uni.downloadFile({ url, success: resolve, fail: reject }))
  if (response.statusCode !== 200) throw new Error('文件下载失败 / Download failed')
  await new Promise<void>((resolve, reject) => uni.openDocument({ filePath: response.tempFilePath, showMenu: true, success: () => resolve(), fail: reject }))
  // #endif
}
export async function downloadCredential(kind: 'certificate' | 'resource', item: { id: string; version?: number; mimeType?: string }) {
  const epoch = currentSessionEpoch(), owner = remoteUser.value?.id
  if (!owner) throw new Error('请先登录 / Please sign in')
  const result = kind === 'certificate'
    ? await request<{ url: string }>(`/certificates/${encodeURIComponent(item.id)}/download`)
    : await request<{ url: string }>(`/resources/${encodeURIComponent(item.id)}/download`, 'POST', { version: item.version, acceptedLicense: true })
  if (epoch !== currentSessionEpoch() || owner !== remoteUser.value?.id) return
  await openAuthorizedFile(result.data.url, item.mimeType ?? 'application/pdf')
}
export async function verifyCertificate(code: string) {
  return (await request<{ certificateNo: string; title: string; issuer: string; status: string; issuedAt: string; revokedAt?: string }>(`/certificates/verify/${encodeURIComponent(code.trim())}`)).data
}
