// frontend/src/features/auth/api.ts
import api from "@/lib/apiClient";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
}

export async function login(payload: LoginPayload) {
  const res = await api.post("/auth/login", payload);
  const { access_token } = res.data;
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access_token);
  }
  return res.data;
}

export async function register(payload: RegisterPayload) {
  const res = await api.post("/auth/register", payload);
  return res.data;
}

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
  }
}