import api from "@/lib/apiClient";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
  phone_number: string;
}

export interface AuthMeResponse {
  id: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
}

export interface RefreshTokenPayload {
  refresh_token: string;
}

export async function login(payload: LoginPayload): Promise<AuthTokenResponse> {
  const res = await api.post<AuthTokenResponse>("/auth/login", {
    email: payload.email,
    password: payload.password,
  });

  const { access_token, refresh_token } = res.data;

  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access_token);
    if (refresh_token) {
      localStorage.setItem("refresh_token", refresh_token);
    }
  }

  return res.data;
}

export async function register(payload: RegisterPayload) {
  const res = await api.post("/auth/register", {
    full_name: payload.full_name,
    email: payload.email,
    phone_number: payload.phone_number,
    password: payload.password,
  });

  return res.data;
}

export async function getMe(): Promise<AuthMeResponse> {
  const res = await api.get<AuthMeResponse>("/auth/me");
  return res.data;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
  }
}