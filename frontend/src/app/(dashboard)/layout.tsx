"use client";

import type { ReactNode } from "react";
import { createContext, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useauth";
import { login, register } from "@/features/auth/api";

export const AuthModalContext = createContext<{ openModal: () => void }>({
  openModal: () => {},
});

function getApiErrorMessage(error: any, fallback = "Something went wrong.") {
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

function navLinkClass(active: boolean) {
  return `transition-colors ${
    active
      ? "text-slate-900 font-semibold"
      : "text-slate-500 hover:text-slate-800"
  }`;
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExamAttemptPage = useMemo(() => {
    return /^\/exams\/[^/]+\/start$/.test(pathname ?? "");
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }

    localStorage.removeItem("access_token");
    localStorage.removeItem("user_name");
    window.location.href = "/";
  };

  const openModal = () => {
    if (isExamAttemptPage) return;

    setAuthMode("login");
    setError(null);
    setShowAuthModal(true);
  };

  const handleRestrictedNav = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!loading && !user) {
      e.preventDefault();
      openModal();
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthLoading(true);

    try {
      if (authMode === "login") {
        await login({ email, password });
        setShowAuthModal(false);
        window.location.reload();
      } else {
        await register({
          full_name: fullName,
          phone_number: phoneNumber,
          email,
          password,
        });

        setAuthMode("login");
        setError("Registration successful! Please sign in.");
      }
    } catch (err: any) {
      setError(
        getApiErrorMessage(
          err,
          `${authMode === "login" ? "Login" : "Registration"} failed.`,
        ),
      );
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <AuthModalContext.Provider value={{ openModal }}>
      <div className="min-h-screen flex flex-col bg-slate-50">
        {!isExamAttemptPage && (
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="flex min-h-[72px] items-center justify-between gap-4">
                <div className="flex items-center gap-8">
                  <Link href="/" className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white text-sm font-bold shadow-sm">
                      EA
                    </div>

                    <div className="hidden sm:block">
                      <p className="text-base font-bold text-slate-800">
                        Exam Assistant
                      </p>
                      <p className="text-xs text-slate-500">
                        AI-powered exam workspace
                      </p>
                    </div>
                  </Link>

                  <nav className="hidden md:flex items-center gap-6 text-sm">
                    <Link href="/" className={navLinkClass(pathname === "/")}>
                      Home
                    </Link>

                    <Link
                      href="/exams/create"
                      onClick={handleRestrictedNav}
                      className={navLinkClass(
                        !!pathname?.startsWith("/exams/create"),
                      )}
                    >
                      Create Exam
                    </Link>

                    <Link
                      href="/history"
                      onClick={handleRestrictedNav}
                      className={navLinkClass(!!pathname?.startsWith("/history"))}
                    >
                      History
                    </Link>

                    {user && (
                      <Link
                        href="/profile"
                        className={navLinkClass(
                          !!pathname?.startsWith("/profile"),
                        )}
                      >
                        Profile
                      </Link>
                    )}
                  </nav>
                </div>

                <div className="flex items-center gap-3">
                  {!loading && user ? (
                    <>
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-sm font-medium text-slate-800">
                          {user.full_name ?? user.email}
                        </span>
                        <span className="text-xs text-slate-500">
                          Authenticated user
                        </span>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline text-sm text-slate-500">
                        Guest access
                      </span>

                      <button
                        onClick={openModal}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors shadow-sm"
                      >
                        Sign In
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        <main className={`flex-1 ${isExamAttemptPage ? "min-h-screen" : ""}`}>
          {children}
        </main>

        {!isExamAttemptPage && showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {authMode === "login" ? "Sign In" : "Create Account"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {authMode === "login"
                        ? "Access your exam workspace and continue where you left off."
                        : "Create an account to generate exams and track your history."}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAuthModal(false)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form onSubmit={handleAuthSubmit} className="px-6 py-5 space-y-4">
                {authMode === "register" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder="Enter your phone number"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="Enter your password"
                  />
                </div>

                {error && (
                  <div
                    className={`rounded-lg px-4 py-3 text-sm font-medium ${
                      error.toLowerCase().includes("successful")
                        ? "border border-green-200 bg-green-50 text-green-700"
                        : "border border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full rounded-lg bg-slate-800 py-2.5 text-white font-medium shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authLoading
                    ? "Processing..."
                    : authMode === "login"
                    ? "Sign In"
                    : "Register"}
                </button>
              </form>

              <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center text-sm text-slate-600">
                {authMode === "login" ? (
                  <>
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("register");
                        setError(null);
                      }}
                      className="font-semibold text-slate-800 hover:underline"
                    >
                      Register here
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        setError(null);
                      }}
                      className="font-semibold text-slate-800 hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthModalContext.Provider>
  );
}