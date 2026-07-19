import api from "@/lib/apiClient";

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

export interface MessageResponse {
  message: string;
}

export async function getProfile(): Promise<ProfileResponse> {
  const res = await api.get<ProfileResponse>("/profile");
  return res.data;
}

export async function updateProfile(
  payload: ProfileUpdatePayload,
): Promise<ProfileResponse> {
  const res = await api.put<ProfileResponse>("/profile", payload);
  return res.data;
}

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<MessageResponse> {
  const res = await api.put<MessageResponse>("/profile/password", payload);
  return res.data;
}

export async function deleteAccount(): Promise<MessageResponse> {
  const res = await api.delete<MessageResponse>("/profile");
  return res.data;
}