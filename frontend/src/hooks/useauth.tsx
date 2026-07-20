"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
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

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// 1. Create the Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 2. Create the Provider Component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Guard against React Strict Mode double-fetching
  const fetchInProgressRef = useRef(false);

  const fetchUser = async () => {
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
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
      fetchInProgressRef.current = false;
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout: logoutFn, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. Export the hook for your components to use
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}