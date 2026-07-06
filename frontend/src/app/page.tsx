import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-10 shadow-2xl">
        <h1 className="text-4xl font-bold">Exam Assistant</h1>
        <p className="mt-4 text-slate-300">
          Create exams from PDFs, run timed tests, and score users after submission.
        </p>
        <div className="mt-6 flex gap-4">
          <Link href="/login" className="rounded-lg bg-blue-600 px-4 py-2">
            Login
          </Link>
          <Link href="/register" className="rounded-lg border border-slate-700 px-4 py-2">
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}
