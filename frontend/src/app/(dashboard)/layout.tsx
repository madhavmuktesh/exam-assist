"use client";

import type { ReactNode } from "react";
import { createContext, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  return `transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-md px-2 py-1 ${
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
  const router = useRouter();
  
  // FIX 1: We grab refreshUser from context so we don't have to hard-reload the page!
  const { user, loading, logout, refreshUser } = useAuth();

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
      // logout function in your api.ts already handles localStorage and redirects, 
      // so we don't need to manually duplicate that logic here.
    } catch (e) {
      console.error("Logout failed:", e);
    }
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
        
        // FIX 2: Seamlessly fetch the user data into React Context without a hard refresh
        await refreshUser(); 
        setShowAuthModal(false);
        router.refresh(); // Tells Next.js to quietly update any server components
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
                  <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 rounded-xl">
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
                      className={navLinkClass(!!pathname?.startsWith("/exams/create"))}
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
                        className={navLinkClass(!!pathname?.startsWith("/profile"))}
                      >
                        Profile
                      </Link>
                    )}
                  </nav>
                </div>

                <div className="flex items-center gap-3">
                  {/* FIX 3: Add a Skeleton Loader so the header doesn't flash "Guest access" on load */}
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <div className="h-4 w-24 animate-pulse rounded bg-slate-200"></div>
                        <div className="h-3 w-16 animate-pulse rounded bg-slate-100"></div>
                      </div>
                      <div className="h-9 w-20 animate-pulse rounded-lg bg-slate-200"></div>
                    </div>
                  ) : user ? (
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
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
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
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2"
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

        {/* FIX 4: Close modal if user clicks the dark backdrop outside the modal */}
        {!isExamAttemptPage && showAuthModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowAuthModal(false);
            }}
          >
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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
                    aria-label="Close modal"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
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
                        disabled={authLoading}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
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
                        disabled={authLoading}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
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
                    disabled={authLoading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
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
                    disabled={authLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="Enter your password"
                  />
                </div>

                {error && (
                  <div
                    className={`rounded-lg px-4 py-3 text-sm font-medium ${
                      error.toLowerCase().includes("successful")
                        ? "border border-green-200 bg-green-50 text-green-700"
                        : "border border-rose-200 bg-rose-50 text-rose-700"
                    }`}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2.5 text-white font-medium shadow-sm transition-colors hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {/* FIX 5: Proper Loading indicator in the button */}
                  {authLoading && (
                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
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
                      disabled={authLoading}
                      onClick={() => {
                        setAuthMode("register");
                        setError(null);
                      }}
                      className="font-semibold text-slate-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded disabled:opacity-50"
                    >
                      Register here
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => {
                        setAuthMode("login");
                        setError(null);
                      }}
                      className="font-semibold text-slate-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded disabled:opacity-50"
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