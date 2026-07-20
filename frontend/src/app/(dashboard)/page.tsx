"use client";

import { useContext, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useauth";
import { AuthModalContext } from "./layout";

export default function UnifiedDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openModal } = useContext(AuthModalContext);
  
  // Track Next.js route transitions safely
  const [isPending, startTransition] = useTransition();
  // Track exactly which route is loading to show the correct spinner
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

  const handleRestrictedAction = (route: string) => {
    if (!loading && user) {
      setTargetRoute(route);
      startTransition(() => {
        router.push(route);
      });
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
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPending && targetRoute === "/exams/create" && (
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Create exam
              </button>

              <button
                onClick={() => handleRestrictedAction("/history")}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPending && targetRoute === "/history" && (
                  <svg className="h-4 w-4 animate-spin text-slate-700" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                View history
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">01</p>
              <h3 className="mt-2 text-base font-bold text-slate-800">Upload content</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Provide a textbook PDF, syllabus, or question paper as the source.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">02</p>
              <h3 className="mt-2 text-base font-bold text-slate-800">Prepare questions</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Generate new questions or extract existing ones with custom settings.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">03</p>
              <h3 className="mt-2 text-base font-bold text-slate-800">Review results</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Check scores, answer breakdowns, feedback, and exam history.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <button
          onClick={() => handleRestrictedAction("/exams/create")}
          disabled={isPending}
          className="group rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-700 transition-colors group-hover:bg-slate-800 group-hover:text-white">
            +
          </div>
          <p className="mt-5 text-2xl font-bold text-slate-800">Create Exam</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Start a new exam workflow using AI generation or PDF-based extraction.
          </p>
          <div className="mt-6 inline-flex items-center text-sm font-medium text-slate-800">
            Open exam builder &rarr;
          </div>
        </button>

        <button
          onClick={() => handleRestrictedAction("/history")}
          disabled={isPending}
          className="group rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-700 transition-colors group-hover:bg-slate-800 group-hover:text-white">
            📊
          </div>
          <p className="mt-5 text-2xl font-bold text-slate-800">View History</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Revisit completed exams, performance summaries, and past result pages.
          </p>
          <div className="mt-6 inline-flex items-center text-sm font-medium text-slate-800">
            Open history &rarr;
          </div>
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Authentication</p>
          
          {loading ? (
            <div className="mt-3 space-y-3">
              <div className="h-6 w-24 animate-pulse rounded-md bg-slate-200"></div>
              <div className="h-4 w-full animate-pulse rounded-md bg-slate-100"></div>
            </div>
          ) : (
            <>
              <p className="mt-2 text-lg font-bold text-slate-800">
                {user ? "Signed in" : "Guest mode"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {user
                  ? `Welcome back, ${user.full_name ?? user.email}.`
                  : "Sign in to create exams and access your history."}
              </p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Exam workflow</p>
          <p className="mt-2 text-lg font-bold text-slate-800">Generate or extract</p>
          <p className="mt-2 text-sm text-slate-600">
            Use content PDFs for AI-generated exams or question papers for extraction.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Results</p>
          <p className="mt-2 text-lg font-bold text-slate-800">Instant review</p>
          <p className="mt-2 text-sm text-slate-600">
            Track scores, percentages, question review, and descriptive feedback.
          </p>
        </div>
      </section>
    </div>
  );
}