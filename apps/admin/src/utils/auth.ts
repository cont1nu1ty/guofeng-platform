/** Adapted from plus-ui src/utils/auth.ts (MIT); source retained in upstream/plus-ui. */
const TokenKey = "Jiafeng-Admin-Token";
let sessionEpoch = 0;
export const currentSessionEpoch = () => sessionEpoch;
export const getToken = () =>
  typeof sessionStorage === "undefined"
    ? null
    : sessionStorage.getItem(TokenKey);
export const setToken = (accessToken: string) => {
  sessionStorage.setItem(TokenKey, accessToken);
  sessionEpoch++;
};
export const removeToken = () => {
  sessionStorage.removeItem(TokenKey);
  sessionEpoch++;
};
