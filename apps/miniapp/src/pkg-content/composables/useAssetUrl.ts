/** Keep packaged assets local on both root and subdirectory H5 deployments. */
export function assetUrl(path: string) {
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
