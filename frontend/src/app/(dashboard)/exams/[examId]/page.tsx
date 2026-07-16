// frontend/src/app/(dashboard)/exams/[examId]/take/page.tsx
"use client";

import React, { use, useEffect, useState } from "react";
import {
  getExam,
  startExamQuestions,
  submitExamResponses,
  QuestionResponseSubmitItem,
} from "@/features/exams/api";
import { useRouter } from "next/navigation";

interface PageProps {
  params: Promise<{ examId: string }>;
}

export default function TakeExamPage({ params }: PageProps) {
  const { examId } = use(params);
  const router = useRouter();

  const [examTitle, setExamTitle] = useState<string>("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const LOCAL_STORAGE_KEY = `exam_progress_${examId}`;

  // 1) Load exam, questions, AND restore saved progress
  useEffect(() => {
    async function load() {
      try {
        const exam = await getExam(examId);
        setExamTitle(exam.title);

        const duration = exam.total_duration_minutes ?? exam.question_time_seconds ?? 60;
        
        // --- NEW: Check LocalStorage for saved progress ---
        const savedProgress = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedProgress) {
          const parsed = JSON.parse(savedProgress);
          setAnswers(parsed.answers || {});
          setRemainingSeconds(parsed.remainingSeconds ?? duration * 60);
        } else {
          setRemainingSeconds(duration * 60);
        }

        const qRes = await startExamQuestions(examId);
        setQuestions(qRes.questions);
      } catch (err: any) {
        console.error("Load exam/questions error:", err?.response?.data ?? err);
        setError(err?.response?.data?.detail || "Failed to load exam questions.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [examId, LOCAL_STORAGE_KEY]);

  // 2) The Timer (unchanged)
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
  }, [remainingSeconds]);

  // --- NEW: Autosave to LocalStorage every time answers or timer changes ---
  useEffect(() => {
    if (loading || remainingSeconds === null) return;
    
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        answers,
        remainingSeconds,
      })
    );
  }, [answers, remainingSeconds, loading, LOCAL_STORAGE_KEY]);

  // --- NEW: Warn user if they try to close the tab/refresh ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submitting) return; // If they clicked submit, let them leave safely
      
      e.preventDefault();
      e.returnValue = ""; // Required for Chrome to show the prompt
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submitting]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const payloadAnswers: QuestionResponseSubmitItem[] = questions.map((q) => {
        const raw = answers[q.id];
        if (q.question_type === "objective") {
          return {
            question_id: q.id,
            question_type: "objective",
            selected_option_ids: raw ? [String(raw)] : [],
            descriptive_answer: null,
            time_taken_seconds: null,
            is_flagged_for_review: false,
          };
        } else {
          return {
            question_id: q.id,
            question_type: "descriptive",
            selected_option_ids: [],
            descriptive_answer: raw ? String(raw) : "",
            time_taken_seconds: null,
            is_flagged_for_review: false,
          };
        }
      });

      await submitExamResponses(examId, { answers: payloadAnswers });
      
      // --- NEW: Clear local storage since the exam was successfully submitted ---
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      
      router.push(`/exams/${examId}/result`);
    } catch (err: any) {
      console.error("Submit exam error:", err?.response?.data ?? err);
      setError(err?.response?.data?.detail || "Failed to submit exam.");
      setSubmitting(false); // Reset submitting state on error so they can try again
    }
  }

  if (loading) return <div className="p-8">Loading exam...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!questions.length) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center border rounded-lg shadow-sm mt-12 bg-white">
        <h2 className="text-2xl font-semibold mb-3 text-slate-800">No questions found</h2>
        <p className="text-slate-600 mb-8 leading-relaxed">
          We couldn't extract or generate any valid questions from the provided document. 
          This usually happens if the PDF format is unsupported or contains only scanned images instead of text.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2 bg-slate-200 text-slate-800 font-medium rounded hover:bg-slate-300 transition-colors"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => router.push("/exams/create")}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors"
          >
            Create New Exam
          </button>
        </div>
      </div>
    );
  }

  return (
    // ... Your exact existing JSX code goes here (the return statement remains entirely unchanged)
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
        {questions.map((q, index: number) => (
          <div key={q.id ?? index} className="border rounded p-4">
            <p className="font-medium mb-2">
              Q{index + 1}. {q.question_text}
            </p>

            {q.question_type === "objective" ? (
              <div className="space-y-1">
                {q.options.map(
                  (
                    opt: { id: string; text: string },
                    i: number,
                  ) => (
                    <label
                      key={opt.id ?? i}
                      className="flex items-center gap-2"
                    >
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
                  ),
                )}
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