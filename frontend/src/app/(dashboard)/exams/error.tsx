"use client";

export default function ExamsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="border rounded p-6 space-y-3 max-w-md w-full">
        <h1 className="text-xl font-semibold">Exam section error</h1>
        <p className="text-sm text-gray-600">{error.message}</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}