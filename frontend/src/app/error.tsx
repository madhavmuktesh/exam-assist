"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="mt-3 text-slate-300">
          An unexpected error occurred while loading this page.
        </p>
        <button
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
        >
          Try again
        </button>
      </div>
    </div>
  );
}