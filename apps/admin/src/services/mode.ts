/** Real mode never falls back to fixtures. Explicit demo remains available for UI review. */
export const isHttpMode = import.meta.env.VITE_DATA_MODE === "http";
export const apiBase = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
  /\/$/,
  "",
);
export const modeText = (live: string, demo: string) =>
  isHttpMode ? live : demo;
