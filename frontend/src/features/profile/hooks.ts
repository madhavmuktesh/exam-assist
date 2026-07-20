import { useState, useEffect, useCallback } from "react";
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  type ProfileResponse,
  type ProfileUpdatePayload,
  type ChangePasswordPayload,
  type MessageResponse,
} from "@/features/profile/api";

export function useProfile() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const update = async (payload: ProfileUpdatePayload): Promise<ProfileResponse> => {
    const updated = await updateProfile(payload);
    setProfile(updated);
    return updated;
  };

  const updatePassword = async (payload: ChangePasswordPayload): Promise<MessageResponse> => {
    return await changePassword(payload);
  };

  const removeAccount = async (): Promise<MessageResponse> => {
    return await deleteAccount();
  };

  return { profile, loading, error, refetch: fetchProfile, update, updatePassword, removeAccount };
}