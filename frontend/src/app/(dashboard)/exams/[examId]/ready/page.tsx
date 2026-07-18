"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getExam } from "@/features/exams/api";
import type { ExamResponse } from "@/features/exams/api";

interface PageProps {
  params: Promise<{ examId: string }>;
}

export default function ExamReadyPage({ params }: PageProps) {
  // Next.js 16: params is a Promise, unwrap it with React.use()
  const { examId } = use(params);

  const router = useRouter();
  const [exam, setExam] = useState<ExamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-lg font-medium text-slate-600">Loading exam details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center mt-12">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium">{error}</div>
      </div>
    );
  }

  if (!exam) {
    return <div className="p-8 text-center text-slate-600 font-medium">Exam not found.</div>;
  }

  // Handle the case where PDF extraction/generation failed on the backend
  if (exam.generation_status === "failed") {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center border rounded-lg shadow-sm mt-12 bg-white">
        <h2 className="text-2xl font-bold mb-3 text-red-600">Generation Failed</h2>
        <p className="text-slate-600 mb-6">
          We encountered an error while trying to process the PDF and extract/generate questions.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Return to Dashboard
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
            <div className="bg-blue-50/50 p-5 md:p-6 rounded-lg border border-blue-100">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
              ⚠️ <strong>Important:</strong> The timer will start immediately after clicking "Start Exam Now". 
              Navigating away from the exam tab is not permitted and will be flagged. Do not refresh the page once you begin.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-end border-t border-slate-100">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => router.push(`/exams/${exam.id}/start`)}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Start Exam Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}