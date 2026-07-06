// frontend/src/hooks/useAuth.ts
"use client";

import { useEffect, useState } from "react";
import { getMe, logout as logoutFn } from "@/features/auth/api";

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMe();
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