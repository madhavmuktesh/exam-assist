"use client";

import { useContext } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useauth";
import { AuthModalContext } from "./layout";

export default function UnifiedDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openModal } = useContext(AuthModalContext);

  const handleRestrictedAction = (route: string) => {
    if (!loading && user) {
      router.push(route);
    } else {
      openModal();
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.5fr_1fr] lg:p-10">
          <div className="space-y-5">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              Smart exam creation and review
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Welcome to Exam Assistant
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                Build AI-powered exams from course PDFs or existing question papers,
                control timing and difficulty, and review detailed results from one
                clean workspace.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleRestrictedAction("/exams/create")}
                className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700"
              >
                Create exam
              </button>

              <button
                onClick={() => handleRestrictedAction("/history")}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                View history
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                01
              </p>
              <h3 className="mt-2 text-base font-bold text-slate-800">
                Upload content
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Provide a textbook PDF, syllabus, or question paper as the source.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                02
              </p>
              <h3 className="mt-2 text-base font-bold text-slate-800">
                Prepare questions
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Generate new questions or extract existing ones with custom settings.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                03
              </p>
              <h3 className="mt-2 text-base font-bold text-slate-800">
                Review results
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Check scores, answer breakdowns, feedback, and exam history.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <button
          onClick={() => handleRestrictedAction("/exams/create")}
          className="group rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-700 transition-colors group-hover:bg-slate-800 group-hover:text-white">
            +
          </div>
          <h2 className="mt-5 text-2xl font-bold text-slate-800">Create Exam</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Start a new exam workflow using AI generation or PDF-based extraction.
          </p>
          <div className="mt-6 inline-flex items-center text-sm font-medium text-slate-800">
            Open exam builder
          </div>
        </button>

        <button
          onClick={() => handleRestrictedAction("/history")}
          className="group rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-700 transition-colors group-hover:bg-slate-800 group-hover:text-white">
            📊
          </div>
          <h2 className="mt-5 text-2xl font-bold text-slate-800">View History</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Revisit completed exams, performance summaries, and past result pages.
          </p>
          <div className="mt-6 inline-flex items-center text-sm font-medium text-slate-800">
            Open history
          </div>
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Authentication</p>
          <p className="mt-2 text-lg font-bold text-slate-800">
            {loading ? "Checking..." : user ? "Signed in" : "Guest mode"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {loading
              ? "Verifying your session."
              : user
              ? `Welcome back, ${user.full_name ?? user.email}.`
              : "Sign in to create exams and access your history."}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Exam workflow</p>
          <p className="mt-2 text-lg font-bold text-slate-800">
            Generate or extract
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Use content PDFs for AI-generated exams or question papers for extraction.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Results</p>
          <p className="mt-2 text-lg font-bold text-slate-800">
            Instant review
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Track scores, percentages, question review, and descriptive feedback.
          </p>
        </div>
      </section>
    </div>
  );
}