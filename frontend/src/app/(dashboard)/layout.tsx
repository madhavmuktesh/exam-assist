// frontend/src/app/(dashboard)/layout.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">Exam Assistant</span>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/dashboard"
                className={pathname?.startsWith("/dashboard") ? "font-medium" : ""}
              >
                Dashboard
              </Link>
              <Link
                href="/exams/create"
                className={pathname?.startsWith("/exams/create") ? "font-medium" : ""}
              >
                Create exam
              </Link>
              <Link
                href="/history"
                className={pathname?.startsWith("/history") ? "font-medium" : ""}
              >
                History
              </Link>
              <Link
                href="/profile"
                className={pathname?.startsWith("/profile") ? "font-medium" : ""}
              >
                Profile
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {!loading && user && (
              <span className="text-gray-700">
                {user.full_name ?? user.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 border rounded text-xs"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}