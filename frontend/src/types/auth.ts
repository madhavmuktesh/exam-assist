export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

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

export interface AuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
}