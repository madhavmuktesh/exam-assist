"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteExamResult,
  getExamResult,
  type ExamResultResponse,
  type AnswerBreakdownItem,
} from "@/features/exams/api";

interface PageProps {
  params: Promise<{ examId: string }>;
}

function getApiErrorMessage(error: any, fallback = "Failed to load exam result.") {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg).filter(Boolean).join(", ");
  }

  if (detail && typeof detail === "object" && "msg" in detail) {
    return String(detail.msg);
  }

  return fallback;
}

export default function ExamResultPage({ params }: PageProps) {
  const { examId } = use(params);
  const router = useRouter();

  const [result, setResult] = useState<ExamResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getExamResult(examId);
        setResult(res);
      } catch (err: any) {
        setError(getApiErrorMessage(err, "Failed to load exam result."));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [examId]);

  async function handleDeleteResult() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this exam result?",
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError(null);
      await deleteExamResult(examId);
      router.push("/history");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to delete exam result."));
      setDeleting(false);
    }
  }

  // FIX 1: Professional Skeleton Loader to prevent layout shifts
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200"></div>
            <div className="flex gap-3">
              <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-200"></div>
              <div className="h-10 w-32 animate-pulse rounded-lg bg-slate-200"></div>
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-16 animate-pulse rounded bg-slate-100"></div>
                <div className="h-8 w-24 animate-pulse rounded bg-slate-200"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 pt-4">
          <div className="h-6 w-36 animate-pulse rounded bg-slate-200"></div>
          <div className="h-48 w-full animate-pulse rounded-xl border border-slate-200 bg-white"></div>
          <div className="h-48 w-full animate-pulse rounded-xl border border-slate-200 bg-white"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <p className="font-medium text-rose-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <p className="text-slate-600">No result found for this exam.</p>
        </div>
      </div>
    );
  }

  const skippedQuestions = result.total_questions - result.attempted_questions;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <h1 className="text-3xl font-bold text-slate-800">Exam Result</h1>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-800 focus-visible:ring-offset-2"
              onClick={handleDeleteResult}
              disabled={deleting}
            >
              {deleting && (
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {deleting ? "Deleting..." : "Delete result"}
            </button>

            <button
              type="button"
              className="px-5 py-2.5 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2"
              onClick={() => router.push("/history")}
              disabled={deleting}
            >
              Back to history
            </button>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-500 font-medium">Score</p>
            <p className="text-2xl font-bold text-slate-800">
              {result.final_score}{" "}
              <span className="text-lg text-slate-400">/ {result.max_marks}</span>
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500 font-medium">Percentage</p>
            <p
              className={`text-2xl font-bold ${
                result.percentage >= 50 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {result.percentage.toFixed(1)}%
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500 font-medium">Attempted</p>
            <p className="text-2xl font-bold text-slate-800">
              {result.attempted_questions}{" "}
              <span className="text-lg text-slate-400">/ {result.total_questions}</span>
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500 font-medium">Status</p>
            <p className="text-lg font-bold text-slate-800 mt-1">
              {String(result.status).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          Skipped questions: <span className="font-semibold text-slate-700">{skippedQuestions}</span>
        </div>
      </div>

      <div className="space-y-4 mt-8">
        <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">
          Question Review
        </h2>

        <div className="space-y-6">
          {result.answer_breakdown.map(
            (
              item: AnswerBreakdownItem & {
                options?: { id: string; text: string }[];
              },
              index: number,
            ) => {
              const isObjective = item.question_type === "objective";

              return (
                <div
                  key={item.question_id}
                  className="border border-slate-200 rounded-xl p-6 space-y-4 bg-white shadow-sm"
                >
                  <div className="flex justify-between items-start gap-4">
                    <p className="font-semibold text-lg text-slate-800 leading-relaxed">
                      <span className="text-indigo-600 mr-2 font-bold">Q{index + 1}.</span>
                      {item.question_text}
                    </p>

                    <span
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${
                        item.is_correct === true
                          ? "bg-emerald-100 text-emerald-800"
                          : item.is_correct === false
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.is_correct === true
                        ? "Correct"
                        : item.is_correct === false
                        ? "Incorrect"
                        : item.review_required
                        ? "Pending Review"
                        : item.is_attempted
                        ? "Evaluated"
                        : "Skipped"}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-500">
                    Marks obtained:{" "}
                    <span
                      className={
                        item.obtained_marks > 0 ? "text-emerald-600 font-bold" : "text-slate-700 font-bold"
                      }
                    >
                      {item.obtained_marks}
                    </span>{" "}
                    / {item.marks}
                  </p>

                  {isObjective ? (
                    <div className="mt-4">
                      {item.options && item.options.length > 0 ? (
                        <div className="space-y-2">
                          {item.options.map((opt) => {
                            const isSelected = item.selected_option_ids?.includes(opt.id);
                            const isCorrect = item.correct_option_ids?.includes(opt.id);

                            let boxStyle =
                              "border-slate-200 bg-slate-50 text-slate-600";
                            let icon = null;

                            if (isCorrect && isSelected) {
                              boxStyle =
                                "border-emerald-300 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300";
                              icon = (
                                <span className="ml-auto font-bold text-emerald-700 text-xs">
                                  ✓ Your Answer
                                </span>
                              );
                            } else if (isCorrect && !isSelected) {
                              boxStyle =
                                "border-emerald-300 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300";
                              icon = (
                                <span className="ml-auto font-bold text-emerald-700 text-xs">
                                  ✓ Correct Answer
                                </span>
                              );
                            } else if (isSelected && !isCorrect) {
                              boxStyle =
                                "border-rose-300 bg-rose-50 text-rose-900 ring-1 ring-rose-300";
                              icon = (
                                <span className="ml-auto font-bold text-rose-700 text-xs">
                                  ✗ Your Answer
                                </span>
                              );
                            }

                            return (
                              <div
                                key={opt.id}
                                className={`flex items-center p-3 rounded-lg border text-sm ${boxStyle}`}
                              >
                                <span className="font-bold w-8">{opt.id}.</span>
                                <span>{opt.text}</span>
                                {icon}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                          <p>
                            <span className="font-semibold text-slate-700">
                              Your answer:
                            </span>{" "}
                            {item.selected_option_ids?.length
                              ? item.selected_option_ids.join(", ")
                              : "Not answered"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">
                              Correct answer:
                            </span>{" "}
                            {item.correct_option_ids?.length
                              ? item.correct_option_ids.join(", ")
                              : "Not specified"}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm space-y-3 mt-4">
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p className="font-semibold text-slate-700 mb-1">Your answer:</p>
                        <p className="text-slate-600 whitespace-pre-wrap">
                          {item.descriptive_answer &&
                          item.descriptive_answer.trim() !== "" ? (
                            item.descriptive_answer
                          ) : (
                            <span className="italic text-slate-400">Not answered</span>
                          )}
                        </p>
                      </div>

                      <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                        <p className="font-semibold text-emerald-800 mb-1">
                          Expected answer / Rubric:
                        </p>
                        <p className="text-emerald-700 whitespace-pre-wrap">
                          {item.correct_answer_text || "Not specified"}
                        </p>
                      </div>
                    </div>
                  )}

                  {(item.explanation || item.ai_feedback) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      {item.explanation && (
                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-800">Explanation: </span>
                          {item.explanation}
                        </div>
                      )}

                      {item.ai_feedback && (
                        <div className="text-sm text-indigo-700 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                          <span className="font-semibold text-indigo-900">AI Feedback: </span>
                          {item.ai_feedback}
                        </div>
                      )}
                    </div>
                  )}

                  {item.review_required && (
                    <p className="text-sm text-amber-700 font-medium mt-2 flex items-center gap-2">
                      <span>⚠️</span> This answer requires manual review by an instructor.
                    </p>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}