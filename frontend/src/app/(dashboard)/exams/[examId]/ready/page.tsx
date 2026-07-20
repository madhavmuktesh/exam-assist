"use client";

import { use, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getExam } from "@/features/exams/api";
import type { ExamResponse } from "@/features/exams/api";

interface PageProps {
  params: Promise<{ examId: string }>;
}

export default function ExamReadyPage({ params }: PageProps) {
  const { examId } = use(params);

  const router = useRouter();
  const [exam, setExam] = useState<ExamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      try {
        const data = await getExam(examId);
        setExam(data);
      } catch (err: any) {
        console.error("Load exam error:", err?.response?.data ?? err);
        let message = "Failed to load exam.";
        if (err?.response?.data?.detail) {
          message = err.response.data.detail;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [examId]);

  const handleStartExam = () => {
    startTransition(() => {
      router.push(`/exams/${examId}/start`);
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
          <div className="bg-slate-100 p-8 space-y-3">
            <div className="h-8 w-64 bg-slate-200 rounded"></div>
            <div className="h-4 w-96 bg-slate-200 rounded"></div>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-slate-50 p-4 rounded-lg space-y-2">
                  <div className="h-3 w-16 bg-slate-200 rounded"></div>
                  <div className="h-7 w-20 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
            <div className="h-24 bg-slate-50 rounded-lg"></div>
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
              <div className="h-11 w-24 bg-slate-200 rounded-lg"></div>
              <div className="h-11 w-36 bg-slate-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center mt-12">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-xl font-medium shadow-sm space-y-4">
          <p>{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (!exam) {
    return <div className="p-8 text-center text-slate-600 font-medium">Exam not found.</div>;
  }

  if (exam.generation_status === "failed") {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center border border-slate-200 rounded-xl shadow-sm mt-12 bg-white">
        <h2 className="text-2xl font-bold mb-3 text-rose-600">Generation Failed</h2>
        <p className="text-slate-600 mb-6">
          We encountered an error while trying to process the PDF and extract/generate questions.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Header Section */}
        <div className="bg-slate-50 p-6 md:p-8 border-b border-slate-200">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">{exam.title}</h1>
          <p className="text-slate-500 font-medium">Please review the exam details carefully before starting.</p>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="text-sm text-slate-500 font-semibold uppercase tracking-wider mb-1">Questions</div>
              <div className="text-2xl font-bold text-slate-800">{exam.total_questions}</div>
              <div className="text-xs text-slate-500 mt-1">
                {exam.objective_count} MCQ / {exam.descriptive_count} Desc.
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="text-sm text-slate-500 font-semibold uppercase tracking-wider mb-1">Time Limit</div>
              <div className="text-2xl font-bold text-slate-800">
                {exam.timer_mode === "full_exam" 
                  ? `${exam.total_duration_minutes}m` 
                  : exam.timer_mode === "per_question"
                    ? `${exam.question_time_seconds}s`
                    : "None"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {exam.timer_mode === "per_question" ? "Per Question" : "Total Time"}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="text-sm text-slate-500 font-semibold uppercase tracking-wider mb-1">Difficulty</div>
              <div className="text-2xl font-bold text-slate-800 capitalize">{exam.difficulty}</div>
              <div className="text-xs text-slate-500 mt-1">Level</div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="text-sm text-slate-500 font-semibold uppercase tracking-wider mb-1">Mode</div>
              <div className="text-2xl font-bold text-slate-800 capitalize">{exam.source_type}</div>
              <div className="text-xs text-slate-500 mt-1">
                {exam.input_mode === "extract_existing_questions" ? "Extracted" : "Generated"}
              </div>
            </div>
          </div>

          {/* Instructions Box */}
          {exam.instructions && (
            <div className="bg-indigo-50/50 p-5 md:p-6 rounded-lg border border-indigo-100">
              <h3 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Instructions
              </h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {exam.instructions}
              </p>
            </div>
          )}

          {/* Anti-cheat Warning */}
          <div className="bg-amber-50 p-4 md:p-5 rounded-lg border border-amber-200">
            <p className="text-amber-800 text-sm md:text-base font-medium">
              ⚠️ <strong>Important:</strong> The timer will start immediately after clicking &quot;Start Exam Now&quot;. 
              Navigating away from the exam tab is not permitted and will be flagged. Do not refresh the page once you begin.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-end border-t border-slate-100">
            <button
              onClick={() => router.push("/")}
              disabled={isPending}
              className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleStartExam}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-500 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-70"
            >
              {isPending && (
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isPending ? "Preparing Workspace..." : "Start Exam Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}