export const isHttpMode = import.meta.env.VITE_DATA_MODE === 'http'
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
