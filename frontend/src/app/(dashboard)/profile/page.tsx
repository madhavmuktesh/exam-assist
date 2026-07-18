"use client";

import { useEffect, useState } from "react";
import api from "@/lib/apiClient";

interface Profile {
  email: string;
  full_name?: string;
  phone_number?: string;
  created_at?: string;
}

function getApiErrorMessage(error: any, fallback = "Failed to load profile.") {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg).filter(Boolean).join(", ");
  }

  if (detail && typeof detail === "object" && "msg" in detail) {
    return String(detail.msg);
  }

  return fallback;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/auth/me");
        setProfile(res.data);
      } catch (err: any) {
        setError(getApiErrorMessage(err, "Failed to load profile."));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <div className="p-8">Loading profile...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!profile) return <div className="p-8">No profile data.</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-semibold">Profile</h1>

      <div className="border rounded p-4 space-y-2 bg-white">
        <p>Email: {profile.email}</p>
        {profile.full_name && <p>Name: {profile.full_name}</p>}
        {profile.phone_number && <p>Phone: {profile.phone_number}</p>}
        {profile.created_at && (
          <p>Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  );
}