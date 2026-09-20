/** Keep packaged assets local on both root and subdirectory H5 deployments. */
export function assetUrl(path: string) {
  // #ifdef H5
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
  // #endif
  // #ifndef H5
  return path
  // #endif
}
