// frontend/src/app/(dashboard)/exams/[examId]/result/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/apiClient";

type QuestionType = "objective" | "descriptive";

interface AnswerBreakdownItem {
  question_id: string;
  question_type: QuestionType;
  question_text: string;
  marks: number;
  obtained_marks: number;
  is_attempted: boolean;
  is_correct: boolean | null;
  selected_option_ids: string[];
  correct_option_ids: string[];
  options: { id: string; text: string }[]; // from score_exam
  descriptive_answer: string | null;
  correct_answer_text: string | null;
  explanation?: string | null;
  review_required: boolean;
}

interface ResultResponse {
  id: string;
  exam_id: string;
  user_id: string;
  total_questions: number;
  attempted_questions: number;
  objective_total: number;
  objective_attempted: number;
  objective_correct: number;
  objective_wrong: number;
  descriptive_total: number;
  descriptive_attempted: number;
  max_marks: number;
  objective_score: number;
  descriptive_score: number;
  final_score: number;
  percentage: number;
  status: string;
  review_required: boolean;
  answer_breakdown: AnswerBreakdownItem[];
  created_at: string;
  updated_at: string;
}

export default function ExamResultPage({ params }: { params: { examId: string } }) {
  const { examId } = params;
  const router = useRouter();

  const [result, setResult] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/responses/exam/${examId}/result`);
        setResult(res.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [examId]);

  if (loading) return <div className="p-8">Loading result...</div>;
  if (!result) return <div className="p-8">No result found.</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      {/* Summary */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Exam Result</h1>
        <div className="border rounded p-4 space-y-1">
          <p>Total questions: {result.total_questions}</p>
          <p>Attempted: {result.attempted_questions}</p>
          <p>Objective: {result.objective_correct} correct / {result.objective_wrong} wrong</p>
          <p>Score: {result.final_score} / {result.max_marks}</p>
          <p className="font-semibold">Percentage: {result.percentage.toFixed(2)}%</p>
          <p>Status: {result.status}</p>
        </div>
      </div>

      {/* Question review */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Question review</h2>
        <div className="space-y-4">
          {result.answer_breakdown.map((item, index) => {
            const isObjective = item.question_type === "objective";
            const hasOptions = isObjective && item.options && item.options.length > 0;

            return (
              <div key={item.question_id} className="border rounded p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-medium">
                    Q{index + 1}. {item.question_text}
                  </p>
                  {item.is_correct !== null && (
                    <span
                      className={
                        item.is_correct
                          ? "text-sm font-semibold text-green-600"
                          : "text-sm font-semibold text-red-600"
                      }
                    >
                      {item.is_correct ? "Correct" : "Incorrect"}
                    </span>
                  )}
                  {item.is_correct === null && item.review_required && (
                    <span className="text-sm font-semibold text-orange-600">
                      Pending review
                    </span>
                  )}
                </div>

                {/* Objective questions: show all options, highlight user vs correct */}
                {hasOptions && (
                  <ul className="ml-4 list-disc text-sm space-y-1">
                    {item.options.map((opt) => {
                      const isUser = item.selected_option_ids.includes(opt.id);
                      const isCorrect = item.correct_option_ids.includes(opt.id);

                      return (
                        <li key={opt.id}>
                          <span
                            className={
                              isCorrect
                                ? "font-semibold text-green-700"
                                : isUser && !isCorrect
                                ? "font-semibold text-red-700"
                                : ""
                            }
                          >
                            {opt.text}
                            {isCorrect && " (correct)"}
                            {isUser && !isCorrect && " (your answer)"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Descriptive questions: show user vs expected text */}
                {!hasOptions && item.question_type === "descriptive" && (
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Your answer: </span>
                      {item.descriptive_answer && item.descriptive_answer.trim() !== "" ? (
                        item.descriptive_answer
                      ) : (
                        <span className="italic text-gray-500">blank</span>
                      )}
                    </p>
                    {item.correct_answer_text && (
                      <p>
                        <span className="font-medium">Expected answer: </span>
                        {item.correct_answer_text}
                      </p>
                    )}
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
          })}
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