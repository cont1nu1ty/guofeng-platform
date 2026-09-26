import { apiBaseUrl } from '../../config/dataMode'
/** Keep packaged assets local on both root and subdirectory H5 deployments. */
export function assetUrl(path: string) {
  if (!path || /^(https?:|blob:|data:)/.test(path)) return path
  if (path.startsWith('/api/'))
    return /^https?:/.test(apiBaseUrl) ? apiBaseUrl.replace(/\/api\/v1\/?$/, '') + path : path
  // #ifdef H5
  // Vite serves subpackage assets from src in development; Uni copies them
  // to the package root for production builds.
  if (import.meta.env.DEV && path.replace(/^\//, '').startsWith('pkg-content/static/'))
    return `${import.meta.env.BASE_URL}src/${path.replace(/^\//, '')}`
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
  // #endif
  // #ifndef H5
  return path
  // #endif
}
