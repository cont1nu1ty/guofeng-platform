/** Uni native blur/confirm events carry the latest text, before H5's throttled model update. */
export function readInputValue(event: unknown, fallback: string | undefined = ''): string {
  if (event && typeof event === 'object' && 'detail' in event) {
    const detail = event.detail
    if (detail && typeof detail === 'object' && 'value' in detail) {
      if (typeof detail.value === 'string') return detail.value
      if (typeof detail.value === 'number') return String(detail.value)
    }
  }
  return fallback ?? ''
}
