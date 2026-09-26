/** Adapted from plus-ui src/utils/auth.ts (MIT); source retained in upstream/plus-ui. */
const TokenKey = "Jiafeng-Admin-Token";
export const getToken = () =>
  typeof sessionStorage === "undefined"
    ? null
    : sessionStorage.getItem(TokenKey);
export const setToken = (accessToken: string) =>
  sessionStorage.setItem(TokenKey, accessToken);
export const removeToken = () => sessionStorage.removeItem(TokenKey);
