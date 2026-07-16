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

export async function login(payload: LoginPayload) {
  const res = await api.post("/auth/login", {
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

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
  }
}