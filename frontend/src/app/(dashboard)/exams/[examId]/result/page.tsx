// frontend/src/app/(dashboard)/exams/[examId]/result/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getExamResult } from "@/features/exams/api";
import type {
  ExamResultResponse,
  AnswerBreakdownItem,
} from "@/features/exams/api";

export default function ExamResultPage({
  params,
}: {
  params: { examId: string };
}) {
  const { examId } = params;
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
        console.error("Load exam result error:", err?.response?.data ?? err);
        let message = "Failed to load exam result.";
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

  if (loading) return <div className="p-8">Loading result...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!result) return <div className="p-8">No result found.</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      {/* Summary */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Exam Result</h1>
        <div className="border rounded p-4 space-y-1">
          <p>Total questions: {result.attempted_question_count + result.skipped_question_count}</p>
          <p>Attempted: {result.attempted_question_count}</p>
          <p>
            Correct: {result.correct_answer_count} / Incorrect:{" "}
            {result.incorrect_answer_count}
          </p>
          <p>
            Score: {result.marks_obtained} / {result.total_marks}
          </p>
          <p className="font-semibold">
            Percentage: {result.percentage.toFixed(2)}%
          </p>
          <p>Status: {result.pass_fail_status.toUpperCase()}</p>
        </div>
      </div>

      {/* Question review */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Question review</h2>
        <div className="space-y-4">
          {result.answer_breakdown.map(
            (item: AnswerBreakdownItem, index: number) => {
              const isObjective = item.question_type === "objective";

              return (
                <div
                  key={item.question_id}
                  className="border rounded p-4 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <p className="font-medium">
                      Q{index + 1}. {item.question_text}
                    </p>
                    <span
                      className={
                        item.is_correct
                          ? "text-sm font-semibold text-green-600"
                          : "text-sm font-semibold text-red-600"
                      }
                    >
                      {item.is_correct ? "Correct" : "Incorrect"}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500">
                    Marks: {item.marks_obtained} / {item.marks}
                  </p>

                  {isObjective ? (
                    <div className="text-sm space-y-1">
                      <p>
                        Your answer:{" "}
                        {item.selected_option_ids &&
                        item.selected_option_ids.length
                          ? item.selected_option_ids.join(", ")
                          : "Not answered"}
                      </p>
                      <p className="text-gray-700">
                        Correct answer:{" "}
                        {item.correct_option_ids &&
                        item.correct_option_ids.length
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