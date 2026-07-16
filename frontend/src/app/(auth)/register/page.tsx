"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/features/auth/api";

function getApiErrorMessage(error: any, fallback = "Something went wrong.") {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(", ");
  }

  if (detail && typeof detail === "object" && "msg" in detail) {
    return String(detail.msg);
  }

  return fallback;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await register({
        full_name: fullName,
        phone_number: phoneNumber,
        email,
        password,
      });
      router.push("/login");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Registration failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Create account</h1>
          <p className="text-sm text-zinc-500">
            Register to start using Exam Assist
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700 mb-1">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-zinc-700 mb-1">
              Phone number
            </label>
            <input
              id="phoneNumber"
              type="tel"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter your phone number"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="text-sm text-center text-zinc-600">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-blue-600 hover:underline">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}