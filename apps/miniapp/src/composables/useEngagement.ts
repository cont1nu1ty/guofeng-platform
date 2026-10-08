import { request, remoteUser } from '../services/api'
import { isHttpMode } from '../config/dataMode'
/** Account/day deduplication is enforced by the server. No anonymous fingerprint is stored. */
export async function recordEngagement(kind: 'media' | 'submission' | 'content' | 'collection', targetId: string, action: 'view' | 'share_intent' = 'view') {
  if (!isHttpMode || !remoteUser.value || !targetId) return
  try { await request('/engagement/events', 'POST', { kind, targetId, action }) }
  catch { /* Optional measurement must not prevent reading or sharing. */ }
}
