"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
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

  if (loading) return <div className="p-8">Loading result...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!result) return <div className="p-8">No result found.</div>;

  const skippedQuestions = result.total_questions - result.attempted_questions;

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Exam Result</h1>
        <div className="border rounded p-4 space-y-1 bg-white">
          <p>Total questions: {result.total_questions}</p>
          <p>Attempted: {result.attempted_questions}</p>
          <p>Skipped: {skippedQuestions}</p>
          <p>
            Objective correct: {result.objective_correct} / wrong:{" "}
            {result.objective_wrong}
          </p>
          <p>
            Score: {result.final_score} / {result.max_marks}
          </p>
          <p className="font-semibold">
            Percentage: {result.percentage.toFixed(2)}%
          </p>
          <p>Status: {String(result.status).toUpperCase()}</p>
          <p>Review required: {result.review_required ? "Yes" : "No"}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Question review</h2>

        <div className="space-y-4">
          {result.answer_breakdown.map(
            (item: AnswerBreakdownItem, index: number) => {
              const isObjective = item.question_type === "objective";

              return (
                <div
                  key={item.question_id}
                  className="border rounded p-4 space-y-2 bg-white"
                >
                  <div className="flex justify-between items-center gap-4">
                    <p className="font-medium">
                      Q{index + 1}. {item.question_text}
                    </p>

                    <span
                      className={
                        item.is_correct === true
                          ? "text-sm font-semibold text-green-600"
                          : item.is_correct === false
                          ? "text-sm font-semibold text-red-600"
                          : "text-sm font-semibold text-amber-600"
                      }
                    >
                      {item.is_correct === true
                        ? "Correct"
                        : item.is_correct === false
                        ? "Incorrect"
                        : item.review_required
                        ? "Pending Review"
                        : item.is_attempted
                        ? "Evaluated"
                        : "Not Answered"}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500">
                    Marks: {item.obtained_marks} / {item.marks}
                  </p>

                  {isObjective ? (
                    <div className="text-sm space-y-1">
                      <p>
                        Your answer:{" "}
                        {item.selected_option_ids?.length
                          ? item.selected_option_ids.join(", ")
                          : "Not answered"}
                      </p>
                      <p className="text-gray-700">
                        Correct answer:{" "}
                        {item.correct_option_ids?.length
                          ? item.correct_option_ids.join(", ")
                          : "Not specified"}
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="font-medium">Your answer: </span>
                        {item.descriptive_answer &&
                        item.descriptive_answer.trim() !== ""
                          ? item.descriptive_answer
                          : "Not answered"}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium">Expected answer: </span>
                        {item.correct_answer_text || "Not specified"}
                      </p>
                    </div>
                  )}

                  {item.explanation && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Explanation: </span>
                      {item.explanation}
                    </p>
                  )}

                  {item.ai_feedback && (
                    <p className="text-xs text-blue-700">
                      <span className="font-medium">AI feedback: </span>
                      {item.ai_feedback}
                    </p>
                  )}

                  {item.review_required && (
                    <p className="text-xs text-amber-700 font-medium">
                      This answer requires manual review.
                    </p>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>

      <button
        className="px-4 py-2 bg-blue-600 text-white rounded"
        onClick={() => router.push("/history")}
      >
        Back to history
      </button>
    </div>
  );
}