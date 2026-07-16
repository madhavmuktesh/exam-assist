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

  // Core Exam State
  const [examTitle, setExamTitle] = useState<string>("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feature State
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const LOCAL_STORAGE_KEY = `exam_progress_${examId}`;

  // 1. Initial Load & LocalStorage Hydration
  useEffect(() => {
    async function load() {
      try {
        const exam = await getExam(examId);
        setExamTitle(exam.title);

        const duration = exam.total_duration_minutes ?? exam.question_time_seconds ?? 60;
        
        const savedProgress = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedProgress) {
          const parsed = JSON.parse(savedProgress);
          setAnswers(parsed.answers || {});
          setFlagged(parsed.flagged || {});
          setRemainingSeconds(parsed.remainingSeconds ?? duration * 60);
          setCurrentIndex(parsed.currentIndex ?? 0);
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

  // 2. Timer Loop
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

  // 3. Autosave Loop
  useEffect(() => {
    if (loading || remainingSeconds === null) return;
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        answers,
        flagged,
        remainingSeconds,
        currentIndex,
      })
    );
  }, [answers, flagged, remainingSeconds, currentIndex, loading, LOCAL_STORAGE_KEY]);

  // 4. Tab Close / Reload Prevention
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submitting) return; 
      e.preventDefault();
      e.returnValue = ""; 
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submitting]);

  // 5. Anti-Cheat: Tab Switching Detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !submitting) {
        alert("WARNING: Tab switching is not allowed during the exam. This action has been recorded.");
        // Note: You can trigger an API call here later to notify the backend
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [submitting]);

  // 6. Submit Logic
  async function handleSubmit() {
    if (submitting) return;
    
    if (!window.confirm("Are you sure you want to submit your exam? You cannot undo this action.")) {
      return;
    }

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
            is_flagged_for_review: !!flagged[q.id],
          };
        } else {
          return {
            question_id: q.id,
            question_type: "descriptive",
            selected_option_ids: [],
            descriptive_answer: raw ? String(raw) : "",
            time_taken_seconds: null,
            is_flagged_for_review: !!flagged[q.id],
          };
        }
      });

      await submitExamResponses(examId, { answers: payloadAnswers });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      router.push(`/exams/${examId}/result`);
    } catch (err: any) {
      console.error("Submit exam error:", err?.response?.data ?? err);
      setError(err?.response?.data?.detail || "Failed to submit exam.");
      setSubmitting(false);
    }
  }

  // Loading & Empty States
  if (loading) return <div className="p-8 flex justify-center mt-12 font-medium text-slate-600">Loading exam environment...</div>;
  if (error) return <div className="p-8 text-center text-red-600 font-medium">{error}</div>;
  if (!questions.length) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center border rounded-lg shadow-sm mt-12 bg-white">
        <h2 className="text-2xl font-semibold mb-3 text-slate-800">No questions found</h2>
        <p className="text-slate-600 mb-8">
          We couldn't extract or generate any valid questions from the provided document.
        </p>
        <button onClick={() => router.push("/dashboard")} className="px-6 py-2 bg-blue-600 text-white rounded">
          Go to Dashboard
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{examTitle}</h1>
        <div className="font-mono text-lg font-medium bg-slate-100 px-4 py-2 rounded shadow-sm border">
          Time left:{" "}
          <span className={remainingSeconds !== null && remainingSeconds < 300 ? "text-red-600 animate-pulse" : ""}>
            {remainingSeconds !== null &&
              `${Math.floor(remainingSeconds / 60).toString().padStart(2, "0")}:${(remainingSeconds % 60).toString().padStart(2, "0")}`}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        
        {/* LEFT COLUMN: Main Question Area */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="border rounded-lg p-6 bg-white shadow-sm flex-1">
            <div className="flex justify-between mb-4 border-b pb-2">
              <span className="font-semibold text-slate-700">Question {currentIndex + 1} of {questions.length}</span>
              <span className="text-sm font-medium text-slate-500 uppercase tracking-wide bg-slate-100 px-2 py-1 rounded">
                {currentQ.question_type}
              </span>
            </div>
            
            <p className="font-medium text-lg mb-8 whitespace-pre-wrap leading-relaxed text-slate-800">
              {currentQ.question_text}
            </p>

            {/* Answer Inputs */}
            {currentQ.question_type === "objective" ? (
              <div className="space-y-3">
                {currentQ.options.map((opt: { id: string; text: string }, i: number) => (
                  <label 
                    key={opt.id ?? i} 
                    className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors
                      ${answers[currentQ.id] === opt.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50 border-slate-200'}
                    `}
                  >
                    <input
                      type="radio"
                      name={currentQ.id}
                      value={opt.id}
                      checked={answers[currentQ.id] === opt.id}
                      onChange={() => setAnswers((a) => ({ ...a, [currentQ.id]: opt.id }))}
                      className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="leading-relaxed text-slate-700">{opt.text}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="w-full border rounded-lg px-4 py-3 min-h-[200px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
                placeholder="Type your detailed answer here..."
                value={answers[currentQ.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [currentQ.id]: e.target.value }))}
              />
            )}

            {/* Question Action Bar: Mark for Review & Clear Selection */}
            <div className="mt-8 flex justify-between items-center border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-3 py-2 rounded transition-colors border border-transparent hover:border-slate-200">
                <input
                  type="checkbox"
                  checked={!!flagged[currentQ.id]}
                  onChange={(e) => setFlagged((prev) => ({ ...prev, [currentQ.id]: e.target.checked }))}
                  className="w-4 h-4 text-amber-500 border-slate-300 rounded focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-700">Mark for Review</span>
              </label>

              {currentQ.question_type === "objective" && answers[currentQ.id] !== undefined && (
                <button
                  onClick={() => {
                    setAnswers((prev) => {
                      const newAnswers = { ...prev };
                      delete newAnswers[currentQ.id];
                      return newAnswers;
                    });
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium px-4 py-2 hover:bg-red-50 rounded transition-colors"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-6 py-2.5 border border-slate-300 bg-white rounded-lg font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm"
            >
              Next
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Question Palette Sidebar */}
        <div className="w-full md:w-80 md:flex-shrink-0">
          <div className="border rounded-lg p-5 bg-white shadow-sm sticky top-6">
            <h3 className="font-semibold text-slate-800 mb-4 border-b pb-3">Question Palette</h3>
            
            <div className="grid grid-cols-5 gap-2.5 mb-8">
              {questions.map((q, idx) => {
                const hasAnswer = answers[q.id] !== undefined && String(answers[q.id]).trim() !== "";
                const isFlagged = !!flagged[q.id];
                const isCurrent = idx === currentIndex;
                
                let bgColor = "bg-slate-100 text-slate-600 hover:bg-slate-200"; 
                if (isFlagged) bgColor = "bg-amber-500 text-white hover:bg-amber-600";
                else if (hasAnswer) bgColor = "bg-green-500 text-white hover:bg-green-600";

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`
                      w-full aspect-square flex items-center justify-center text-sm font-semibold rounded-md transition-all
                      ${bgColor}
                      ${isCurrent ? 'ring-2 ring-blue-600 ring-offset-2 scale-110 shadow-md z-10 relative' : ''}
                    `}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Status Legend */}
            <div className="space-y-3 mb-8 text-sm font-medium text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-green-500 rounded-sm shadow-sm"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-amber-500 rounded-sm shadow-sm"></div>
                <span>Marked for Review</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-slate-200 border border-slate-300 rounded-sm"></div>
                <span>Not Answered</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full px-4 py-3.5 bg-emerald-600 text-white font-bold rounded-lg disabled:opacity-60 hover:bg-emerald-700 transition-colors shadow-sm"
            >
              {submitting ? "Submitting..." : "Submit Exam"}
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}