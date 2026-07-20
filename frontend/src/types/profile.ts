export interface ProfileResponse {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdatePayload {
  full_name?: string;
  phone_number?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}