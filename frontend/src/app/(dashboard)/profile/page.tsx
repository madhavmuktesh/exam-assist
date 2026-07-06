// frontend/src/app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import api from "@/lib/apiClient";

interface Profile {
  email: string;
  full_name?: string;
  created_at?: string;
  exams_taken?: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/profile/me");
        setProfile(res.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8">Loading profile...</div>;
  if (!profile) return <div className="p-8">No profile data.</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <div className="border rounded p-4 space-y-2">
        <p>Email: {profile.email}</p>
        {profile.full_name && <p>Name: {profile.full_name}</p>}
        {profile.created_at && (
          <p>Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
        )}
        {typeof profile.exams_taken === "number" && (
          <p>Exams taken: {profile.exams_taken}</p>
        )}
      </div>
    </div>
  );
}