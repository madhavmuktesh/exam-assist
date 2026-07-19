"use client";

import type { ReactNode } from "react";
import { createContext, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useauth";
import { login, register } from "@/features/auth/api";

// --- Global Context so any page can open the auth modal ---
export const AuthModalContext = createContext<{ openModal: () => void }>({
  openModal: () => {},
});

// --- Error Helper ---
function getApiErrorMessage(error: any, fallback = "Something went wrong.") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg).filter(Boolean).join(", ");
  if (detail && typeof detail === "object" && "msg" in detail) return String(detail.msg);
  return fallback;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const { user, loading, logout } = useAuth();

  // --- Modal State (pendingAction removed) ---
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // --- Form State ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Refresh the current page so the UI updates to logged-in state
        window.location.reload();
      } else {
        await register({ full_name: fullName, phone_number: phoneNumber, email, password });
        setAuthMode("login");
        setError("Registration successful! Please log in.");
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, `${authMode === "login" ? "Login" : "Registration"} failed.`));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <AuthModalContext.Provider value={{ openModal }}>
      <div className="min-h-screen flex flex-col bg-slate-50 relative">
        
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-8">
              <span className="text-xl font-bold text-blue-600 tracking-tight">Exam Assistant</span>
              <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
                <Link href="/" className={`hover:text-blue-600 transition-colors ${pathname === "/" ? "text-blue-600 font-bold" : ""}`}>
                  Home
                </Link>
                <Link href="/exams/create" onClick={handleRestrictedNav} className={`hover:text-blue-600 transition-colors ${pathname?.startsWith("/exams/create") ? "text-blue-600 font-bold" : ""}`}>
                  Create Exam
                </Link>
                <Link href="/history" onClick={handleRestrictedNav} className={`hover:text-blue-600 transition-colors ${pathname?.startsWith("/history") ? "text-blue-600 font-bold" : ""}`}>
                  History
                </Link>
                {user && (
                  <Link href="/profile" className={`hover:text-blue-600 transition-colors ${pathname?.startsWith("/profile") ? "text-blue-600 font-bold" : ""}`}>
                    Profile
                  </Link>
                )}
              </nav>
            </div>
            
            <div className="flex items-center gap-4 text-sm font-medium">
              {!loading && user ? (
                <>
                  <span className="text-slate-700">Hello, {user.full_name ?? user.email}</span>
                  <button onClick={handleLogout} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <span className="text-slate-500">Hello, Guest</span>
                  <button onClick={openModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                    Sign In
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        {showAuthModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{authMode === "login" ? "Sign In" : "Create Account"}</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {authMode === "login" ? "Welcome back to Exam Assistant" : "Join us to create and take exams"}
                  </p>
                </div>
                <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold p-2">✕</button>
              </div>

              <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">
                {authMode === "register" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                      <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                      <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>

                {error && (
                  <div className={`p-3 rounded-lg text-sm font-medium ${error.includes("successful") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700 border border-red-100"}`}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={authLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-60 mt-2 shadow-sm">
                  {authLoading ? "Processing..." : authMode === "login" ? "Sign In" : "Register"}
                </button>
              </form>

              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-sm text-slate-600">
                {authMode === "login" ? (
                  <>Don't have an account? <button type="button" onClick={() => { setAuthMode("register"); setError(null); }} className="text-blue-600 font-bold hover:underline">Register here</button></>
                ) : (
                  <>Already have an account? <button type="button" onClick={() => { setAuthMode("login"); setError(null); }} className="text-blue-600 font-bold hover:underline">Sign in</button></>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthModalContext.Provider>
  );
}