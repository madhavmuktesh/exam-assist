import { TOKEN_KEYS } from "@/lib/constants";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEYS.ACCESS);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEYS.REFRESH);
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEYS.ACCESS, accessToken);
  if (refreshToken) {
    localStorage.setItem(TOKEN_KEYS.REFRESH, refreshToken);
  }
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEYS.ACCESS);
  localStorage.removeItem(TOKEN_KEYS.REFRESH);
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}