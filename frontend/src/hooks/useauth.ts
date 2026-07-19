"use client";

import { useEffect, useState } from "react";
import { getMe, logout as logoutFn, type AuthMeResponse } from "@/features/auth/api";

export interface AuthUser {
  id?: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("access_token")
            : null;

        if (!token) {
          setUser(null);
          return;
        }

        const data: AuthMeResponse = await getMe();
        setUser(data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { user, loading, logout: logoutFn };
}