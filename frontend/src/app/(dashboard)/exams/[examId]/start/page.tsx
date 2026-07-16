// frontend/src/app/(dashboard)/exams/[examId]/start/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getExam,
  startExamQuestions,
  submitExamResponses,
  QuestionResponseSubmitItem,
  StudentQuestion,
} from "@/features/exams/api";

interface PageProps {
  params: Promise<{ examId: string }>;
}

export default function TakeExamStartPage({ params }: PageProps) {
  // Next.js 16: params is a Promise, unwrap with React.use()
  const { examId } = use(params);
  const router = useRouter();

  const [examTitle, setExamTitle] = useState<string>("");
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load exam + questions
  useEffect(() => {
    async function load() {
      try {
        const exam = await getExam(examId);
        setExamTitle(exam.title);

        const duration =
          exam.total_duration_minutes ?? exam.question_time_seconds ?? 60;
        setRemainingSeconds(duration * 60);

        const qRes = await startExamQuestions(examId);
        setQuestions(qRes.questions);
        console.log("Sample question:", qRes.questions[0]);
      } catch (err: any) {
        console.error("Load exam/questions error:", err?.response?.data ?? err);
        let message = "Failed to load exam questions.";
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

  // Timer
  useEffect(() => {
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      handleSubmit();
      return;
    }
    const id = setInterval(() => {
      setRemainingSeconds((s) => (s !== null ? s - 1 : s));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const payloadAnswers: QuestionResponseSubmitItem[] = questions.map((q) => {
        const raw = answers[q.id];

        if (q.question_type === "objective") {
          const selectedIds = raw ? [String(raw)] : [];
          return {
            question_id: q.id,
            question_type: "objective",
            selected_option_ids: selectedIds,
            descriptive_answer: null,
            time_taken_seconds: null,
            is_flagged_for_review: false,
          };
        } else {
          const text = raw ? String(raw) : "";
          return {
            question_id: q.id,
            question_type: "descriptive",
            selected_option_ids: [],
            descriptive_answer: text,
            time_taken_seconds: null,
            is_flagged_for_review: false,
          };
        }
      });

      await submitExamResponses(examId, { answers: payloadAnswers });
      router.push(`/exams/${examId}/result`);
    } catch (err: any) {
      console.error("Submit exam error:", err?.response?.data ?? err);
      let message = "Failed to submit exam.";
      if (err?.response?.data?.detail) {
        message = err.response.data.detail;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8">Loading exam...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!questions.length)
    return <div className="p-8">No questions available for this exam.</div>;

  // Optional filter to hide any leftover broken objective questions
  const visibleQuestions = questions.filter((q) =>
    q.question_type === "objective" ? q.options.length > 0 : true,
  );

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">{examTitle}</h1>
        <div className="font-mono">
          Time left:{" "}
          {remainingSeconds !== null &&
            `${Math.floor(remainingSeconds / 60)
              .toString()
              .padStart(2, "0")}:${(remainingSeconds % 60)
              .toString()
              .padStart(2, "0")}`}
        </div>
      </div>

      <div className="space-y-6">
        {visibleQuestions.map((q, index) => (
          <div key={q.id} className="border rounded p-4">
            <p className="font-medium mb-2">
              Q{index + 1}. {q.question_text}
            </p>

            {q.question_type === "objective" ? (
              <div className="space-y-1">
                {q.options.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.id}
                      checked={answers[q.id] === opt.id}
                      onChange={() =>
                        setAnswers((a) => ({
                          ...a,
                          [q.id]: opt.id,
                        }))
                      }
                    />
                    <span>{opt.text}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="w-full border rounded px-3 py-2"
                rows={4}
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({
                    ...a,
                    [q.id]: e.target.value,
                  }))
                }
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit exam"}
        </button>
      </div>
    </div>
  );
}