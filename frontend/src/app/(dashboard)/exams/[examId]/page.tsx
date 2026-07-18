"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getExam,
  startExamQuestions,
  submitExamResponses,
  type ExamResponse,
  type StudentQuestion,
  type QuestionResponseSubmitItem,
} from "@/features/exams/api";

interface PageProps {
  params: Promise<{ examId: string }>;
}

function getApiErrorMessage(error: any, fallback = "Something went wrong.") {
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

export default function TakeExamPage({ params }: PageProps) {
  const { examId } = use(params);
  const router = useRouter();

  const [exam, setExam] = useState<ExamResponse | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  
  // Timer & Mode state
  const [timerMode, setTimerMode] = useState<string>("full_exam");
  const [questionTimeLimit, setQuestionTimeLimit] = useState<number>(60);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const LOCAL_STORAGE_KEY = `exam_progress_${examId}`;

  useEffect(() => {
    async function load() {
      try {
        const examRes = await getExam(examId);
        setExam(examRes);
        
        const mode = examRes.timer_mode || "full_exam";
        setTimerMode(mode);

        let totalSeconds = 60;
        if (mode === "per_question") {
          totalSeconds = examRes.question_time_seconds ?? 60;
          setQuestionTimeLimit(totalSeconds);
        } else {
          totalSeconds = examRes.total_duration_minutes != null 
            ? examRes.total_duration_minutes * 60 
            : 3600;
        }

        const savedProgress =
          typeof window !== "undefined"
            ? localStorage.getItem(LOCAL_STORAGE_KEY)
            : null;

        if (savedProgress) {
          const parsed = JSON.parse(savedProgress);
          setAnswers(parsed.answers || {});
          setFlagged(parsed.flagged || {});
          setRemainingSeconds(parsed.remainingSeconds ?? totalSeconds);
          setCurrentIndex(parsed.currentIndex ?? 0);
        } else {
          setRemainingSeconds(totalSeconds);
        }

        const qRes = await startExamQuestions(examId);
        setQuestions(qRes.questions);
      } catch (err: any) {
        setError(getApiErrorMessage(err, "Failed to load exam questions."));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [examId, LOCAL_STORAGE_KEY]);

  useEffect(() => {
    if (remainingSeconds === null || loading || submitting || autoSubmitting) return;
    
    if (remainingSeconds <= 0) {
      if (timerMode === "per_question" && currentIndex < questions.length - 1) {
        // Auto-advance for per-question timer
        setCurrentIndex((c) => c + 1);
        setRemainingSeconds(questionTimeLimit);
      } else {
        // Full exam over, or last question of per_question finished
        void handleSubmit(true);
      }
      return;
    }

    const id = setInterval(() => {
      setRemainingSeconds((s) => (s !== null && s > 0 ? s - 1 : 0));
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, loading, submitting, autoSubmitting, timerMode, currentIndex, questions.length, questionTimeLimit]);

  useEffect(() => {
    if (loading || remainingSeconds === null || typeof window === "undefined")
      return;

    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        answers,
        flagged,
        remainingSeconds,
        currentIndex,
      }),
    );
  }, [answers, flagged, remainingSeconds, currentIndex, loading, LOCAL_STORAGE_KEY]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submitting || autoSubmitting) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submitting, autoSubmitting]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !submitting && !autoSubmitting) {
        alert(
          "Warning: Tab switching is not allowed during the exam. This action has been recorded.",
        );
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [submitting, autoSubmitting]);

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      if (timerMode === "per_question") {
        setRemainingSeconds(questionTimeLimit);
      }
    }
  }

  async function handleSubmit(isAutoSubmit = false) {
    if (submitting || autoSubmitting) return;

    if (!isAutoSubmit) {
      const confirmed = window.confirm(
        "Are you sure you want to submit your exam? You cannot undo this action.",
      );
      if (!confirmed) return;
      setSubmitting(true);
    } else {
      setAutoSubmitting(true);
    }

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
        }

        return {
          question_id: q.id,
          question_type: "descriptive",
          selected_option_ids: [],
          descriptive_answer: raw ? String(raw) : "",
          time_taken_seconds: null,
          is_flagged_for_review: !!flagged[q.id],
        };
      });

      await submitExamResponses(examId, { answers: payloadAnswers });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      router.push(`/exams/${examId}/result`);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to submit exam."));
      setSubmitting(false);
      setAutoSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center mt-12 font-medium text-slate-600">
        Loading exam environment...
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-600 font-medium">{error}</div>;
  }

  if (!questions.length) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center border rounded-lg shadow-sm mt-12 bg-white">
        <h2 className="text-2xl font-semibold mb-3 text-slate-800">
          No questions found
        </h2>
        <p className="text-slate-600 mb-8">
          We couldn&apos;t extract or generate any valid questions from the
          provided document.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-6 py-2 bg-blue-600 text-white rounded"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          {exam?.title ?? "Exam"}
        </h1>
        <div className="font-mono text-lg font-medium bg-slate-100 px-4 py-2 rounded shadow-sm border">
          Time left:{" "}
          <span
            className={
              remainingSeconds !== null && remainingSeconds < 300
                ? "text-red-600 animate-pulse"
                : "text-blue-700"
            }
          >
            {remainingSeconds !== null &&
              `${Math.floor(remainingSeconds / 60)
                .toString()
                .padStart(2, "0")}:${(remainingSeconds % 60)
                .toString()
                .padStart(2, "0")}`}
          </span>
        </div>
      </div>

      {/* FIXED: Added items-start so the sidebar doesn't stretch */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* Left Column Area */}
        <div className="flex-1 w-full flex flex-col gap-4">
          <div className="border rounded-lg p-6 bg-white shadow-sm flex-1">
            <div className="flex justify-between mb-4 border-b pb-2">
              <span className="font-semibold text-slate-700">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-sm font-medium text-slate-500 uppercase tracking-wide bg-slate-100 px-2 py-1 rounded">
                {currentQ.question_type}
              </span>
            </div>

            <p className="font-medium text-lg mb-8 whitespace-pre-wrap leading-relaxed text-slate-800">
              {currentQ.question_text}
            </p>

            {currentQ.question_type === "objective" ? (
              <div className="space-y-3">
                {currentQ.options.map((opt, i) => (
                  <label
                    key={opt.id ?? i}
                    className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      answers[currentQ.id] === opt.id
                        ? "border-blue-500 bg-blue-50"
                        : "hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name={currentQ.id}
                      value={opt.id}
                      checked={answers[currentQ.id] === opt.id}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [currentQ.id]: opt.id }))
                      }
                      className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="leading-relaxed text-slate-700">
                      {opt.text}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="w-full border rounded-lg px-4 py-3 min-h-[200px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
                placeholder="Type your detailed answer here..."
                value={answers[currentQ.id] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [currentQ.id]: e.target.value }))
                }
              />
            )}

            <div className="mt-8 flex justify-between items-center border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-3 py-2 rounded transition-colors border border-transparent hover:border-slate-200">
                <input
                  type="checkbox"
                  checked={!!flagged[currentQ.id]}
                  onChange={(e) =>
                    setFlagged((prev) => ({
                      ...prev,
                      [currentQ.id]: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-amber-500 border-slate-300 rounded focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-700">
                  Mark for Review
                </span>
              </label>

              {currentQ.question_type === "objective" &&
                answers[currentQ.id] !== undefined && (
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

          <div className="flex justify-between">
            {/* FIXED: Hide Previous button in per_question mode */}
            {timerMode !== "per_question" ? (
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-6 py-2.5 border border-slate-300 bg-white rounded-lg font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
              >
                Previous
              </button>
            ) : (
              <div></div> /* Empty div to push Next button to the right */
            )}
            
            <button
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
              className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm"
            >
              Next
            </button>
          </div>
        </div>

        {/* Right Sidebar Area */}
        <div className="w-full md:w-80 md:flex-shrink-0 lg:sticky lg:top-6">
          <div className="border rounded-lg p-5 bg-white shadow-sm flex flex-col">
            <h3 className="font-semibold text-slate-800 mb-4 border-b pb-3 flex-shrink-0">
              Question Palette
            </h3>

            {/* FIXED: Hardcoded max-height and overflow to guarantee scrolling */}
            <div 
              className="grid grid-cols-5 gap-2.5 mb-6 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-300"
              style={{ maxHeight: '350px' }}
            >
              {questions.map((q, idx) => {
                const hasAnswer =
                  answers[q.id] !== undefined &&
                  String(answers[q.id]).trim() !== "";
                const isFlagged = !!flagged[q.id];
                const isCurrent = idx === currentIndex;

                let bgColor = "bg-slate-100 text-slate-600 hover:bg-slate-200";
                
                // Add muted style for disabled per_question mode items
                if (timerMode === "per_question" && !isCurrent) {
                  bgColor = "bg-slate-50 text-slate-400 opacity-60";
                } else if (isFlagged) {
                  bgColor = "bg-amber-500 text-white hover:bg-amber-600";
                } else if (hasAnswer) {
                  bgColor = "bg-green-500 text-white hover:bg-green-600";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      if (timerMode !== "per_question") {
                        setCurrentIndex(idx);
                      }
                    }}
                    disabled={timerMode === "per_question"}
                    className={`w-full aspect-square flex items-center justify-center text-sm font-semibold rounded-md transition-all ${bgColor} ${
                      isCurrent
                        ? "ring-2 ring-blue-600 ring-offset-2 scale-110 shadow-md z-10 relative"
                        : ""
                    } ${timerMode === "per_question" && !isCurrent ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 mb-6 text-sm font-medium text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100 flex-shrink-0">
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
              onClick={() => void handleSubmit(false)}
              disabled={submitting || autoSubmitting}
              className="w-full px-4 py-3.5 bg-emerald-600 text-white font-bold rounded-lg disabled:opacity-60 hover:bg-emerald-700 transition-colors shadow-sm flex-shrink-0"
            >
              {submitting || autoSubmitting ? "Submitting..." : "Submit Exam"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}