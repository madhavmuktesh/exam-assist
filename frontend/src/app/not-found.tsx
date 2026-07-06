import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h1 className="text-3xl font-bold">404 - Page not found</h1>
        <p className="mt-3 text-slate-300">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}