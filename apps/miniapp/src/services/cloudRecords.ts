import { ApiError, command, currentSessionEpoch, request } from './api'
import type { CloudRecitation, FamilyPromise } from '../domain/cloudRecords'

export const saveRecitation = (title: string, fileId: string) =>
  command<CloudRecitation>('recitation.create', undefined, {
    title: title.trim(),
    fileId,
    consent: true,
  })
export const removeRecitation = (record: CloudRecitation) =>
  command('recitation.remove', record.id, undefined, record.lockVersion)
export const saveFamilyPromise = (
  personId: string,
  text: string,
  previous?: Pick<FamilyPromise, 'id' | 'lockVersion'>,
) =>
  command<FamilyPromise>(
    'familyPromise.save',
    previous?.id,
    { personId, text: text.trim() },
    previous?.lockVersion ?? 0,
  )
export const removeFamilyPromise = (record: FamilyPromise) =>
  command('familyPromise.remove', record.id, undefined, record.lockVersion)

/** Never persist a signed URL; reauthorize every new playback, including retries. */
export async function recitationUrl(fileId: string) {
  const epoch = currentSessionEpoch()
  const response = await request<{ url: string }>(`/files/${encodeURIComponent(fileId)}/url`)
  if (epoch !== currentSessionEpoch())
    throw new ApiError('SESSION_CHANGED', '账户已改变，请重新打开记录。')
  return response.data.url
}
