"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  cancelExam,
  pauseExam,
  startExam,
  submitExamResponses,
  type ExamSubmitRequest,
  type QuestionResponseSubmitItem,
  type QuestionType,
  type StartExamResponse,
  type StudentQuestion,
} from "@/features/exams/api";

type ObjectiveAnswerMap = Record<string, string[]>;
type DescriptiveAnswerMap = Record<string, string>;
type FlaggedMap = Record<string, boolean>;
type TimeTakenMap = Record<string, number>;

type LeaveAction = "pause" | "cancel" | "submit";

function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

function getApiErrorMessage(error: any, fallback: string): string {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg).filter(Boolean).join(", ") || fallback;
  }

  if (detail && typeof detail === "object" && "msg" in detail) {
    return String(detail.msg);
  }

  return fallback;
}

function buildAnswerPayload(
  questions: StudentQuestion[],
  objectiveAnswers: ObjectiveAnswerMap,
  descriptiveAnswers: DescriptiveAnswerMap,
  flaggedMap: FlaggedMap,
  timeTakenMap: TimeTakenMap,
): ExamSubmitRequest {
  const answers: QuestionResponseSubmitItem[] = questions.map((question) => ({
    question_id: question.id,
    question_type: question.question_type as QuestionType,
    selected_option_ids: objectiveAnswers[question.id] ?? [],
    descriptive_answer:
      question.question_type === "descriptive"
        ? descriptiveAnswers[question.id] ?? ""
        : null,
    time_taken_seconds: timeTakenMap[question.id] ?? 0,
    is_flagged_for_review: flaggedMap[question.id] ?? false,
  }));

  return { answers };
}

export default function TakeExamPage() {
  const router = useRouter();
  const params = useParams();
  const rawExamId = params?.examId;
  const examId = Array.isArray(rawExamId) ? rawExamId[0] : String(rawExamId ?? "");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timerMode, setTimerMode] =
    useState<StartExamResponse["timer_mode"]>("full_exam");
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const [objectiveAnswers, setObjectiveAnswers] =
    useState<ObjectiveAnswerMap>({});
  const [descriptiveAnswers, setDescriptiveAnswers] =
    useState<DescriptiveAnswerMap>({});
  const [flaggedMap, setFlaggedMap] = useState<FlaggedMap>({});
  const [timeTakenMap, setTimeTakenMap] = useState<TimeTakenMap>({});

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingBackNavigation, setPendingBackNavigation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMountedRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const autoSubmittedRef = useRef(false);
  const submittingRef = useRef(false);
  const questionEnterTimestampRef = useRef<number>(Date.now());
  const intervalRef = useRef<number | null>(null);
  const lastSyncedRemainingRef = useRef<number>(0);

  const currentQuestion = questions[currentIndex] ?? null;

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  const answeredCount = useMemo(() => {
    return questions.filter((question) => {
      if (question.question_type === "objective") {
        return (objectiveAnswers[question.id]?.length ?? 0) > 0;
      }
      return (descriptiveAnswers[question.id] ?? "").trim().length > 0;
    }).length;
  }, [questions, objectiveAnswers, descriptiveAnswers]);

  const reviewCount = useMemo(() => {
    return Object.values(flaggedMap).filter(Boolean).length;
  }, [flaggedMap]);

  const pendingCount = useMemo(() => {
    return Math.max(questions.length - answeredCount, 0);
  }, [questions.length, answeredCount]);

  const computeCurrentQuestionElapsed = useCallback(() => {
    if (!currentQuestion) return 0;
    return Math.max(
      0,
      Math.floor((Date.now() - questionEnterTimestampRef.current) / 1000),
    );
  }, [currentQuestion]);

  const buildMergedTimeTakenMap = useCallback((): TimeTakenMap => {
    if (!currentQuestion) return timeTakenMap;

    const elapsedSeconds = computeCurrentQuestionElapsed();
    return {
      ...timeTakenMap,
      [currentQuestion.id]: (timeTakenMap[currentQuestion.id] ?? 0) + elapsedSeconds,
    };
  }, [currentQuestion, timeTakenMap, computeCurrentQuestionElapsed]);

  const syncCurrentQuestionTime = useCallback(() => {
    if (!currentQuestion) return;

    const elapsedSeconds = computeCurrentQuestionElapsed();
    if (elapsedSeconds <= 0) return;

    setTimeTakenMap((prev) => ({
      ...prev,
      [currentQuestion.id]: (prev[currentQuestion.id] ?? 0) + elapsedSeconds,
    }));

    questionEnterTimestampRef.current = Date.now();
  }, [currentQuestion, computeCurrentQuestionElapsed]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimerLoop = useCallback(() => {
    stopTimer();

    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          stopTimer();
          return 0;
        }
        const next = prev - 1;
        lastSyncedRemainingRef.current = next;
        return next;
      });
    }, 1000);
  }, [stopTimer]);

  const handleSelectObjective = useCallback((questionId: string, optionId: string) => {
    setObjectiveAnswers((prev) => ({
      ...prev,
      [questionId]: [optionId],
    }));
  }, []);

  const handleDescriptiveChange = useCallback((questionId: string, value: string) => {
    setDescriptiveAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  }, []);

  const handleToggleFlag = useCallback(() => {
    if (!currentQuestion) return;

    setFlaggedMap((prev) => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
  }, [currentQuestion]);

  const goToQuestion = useCallback(
    (index: number) => {
      if (index < 0 || index >= questions.length) return;
      syncCurrentQuestionTime();
      setCurrentIndex(index);
      setError(null);
    },
    [questions.length, syncCurrentQuestionTime],
  );

  const hydrateFromStartResponse = useCallback((data: StartExamResponse) => {
    setQuestions(data.questions);
    setTimerMode(data.timer_mode);
    setError(null);
    autoSubmittedRef.current = false;

    if (data.resume_payload) {
      const restoredObjective: ObjectiveAnswerMap = {};
      const restoredDescriptive: DescriptiveAnswerMap = {};

      Object.entries(data.resume_payload.answers ?? {}).forEach(
        ([questionId, value]) => {
          const question = data.questions.find((q) => q.id === questionId);
          if (!question) return;

          if (question.question_type === "objective") {
            restoredObjective[questionId] = value ? [value] : [];
          } else {
            restoredDescriptive[questionId] = value ?? "";
          }
        },
      );

      setObjectiveAnswers(restoredObjective);
      setDescriptiveAnswers(restoredDescriptive);
      setFlaggedMap(data.resume_payload.flagged ?? {});
      setTimeTakenMap({});
      setCurrentIndex(
        Math.min(
          data.resume_payload.current_index ?? 0,
          Math.max(data.questions.length - 1, 0),
        ),
      );

      const safeRemaining =
        data.timer_mode === "full_exam" || data.timer_mode === "per_section"
          ? data.resume_payload.remaining_seconds ?? 0
          : data.question_time_seconds ?? 0;

      setRemainingSeconds(safeRemaining);
      lastSyncedRemainingRef.current = safeRemaining;
    } else {
      setObjectiveAnswers({});
      setDescriptiveAnswers({});
      setFlaggedMap({});
      setTimeTakenMap({});
      setCurrentIndex(0);

      const initialRemaining =
        data.timer_mode === "full_exam" || data.timer_mode === "per_section"
          ? (data.total_duration_minutes ?? 0) * 60
          : data.question_time_seconds ?? 0;

      setRemainingSeconds(initialRemaining);
      lastSyncedRemainingRef.current = initialRemaining;
    }

    questionEnterTimestampRef.current = Date.now();
  }, []);

  const loadExam = useCallback(async () => {
    if (!examId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await startExam(examId);
      hydrateFromStartResponse(data);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load exam."));
    } finally {
      setLoading(false);
    }
  }, [examId, hydrateFromStartResponse]);

  const handleSubmitExam = useCallback(async () => {
    if (!questions.length || !examId || submittingRef.current) return;

    try {
      setSubmitting(true);
      setError(null);

      const mergedTimeTakenMap = buildMergedTimeTakenMap();
      setTimeTakenMap(mergedTimeTakenMap);
      questionEnterTimestampRef.current = Date.now();

      const payload = buildAnswerPayload(
        questions,
        objectiveAnswers,
        descriptiveAnswers,
        flaggedMap,
        mergedTimeTakenMap,
      );

      await submitExamResponses(examId, payload);
      allowNavigationRef.current = true;
      stopTimer();
      router.replace(`/exams/${examId}/result`);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to submit exam."));
    } finally {
      setSubmitting(false);
      setShowLeaveModal(false);
    }
  }, [
    questions,
    examId,
    objectiveAnswers,
    descriptiveAnswers,
    flaggedMap,
    buildMergedTimeTakenMap,
    router,
    stopTimer,
  ]);

  const buildPausePayload = useCallback(() => {
    const mergedAnswers: Record<string, string> = {};

    Object.entries(objectiveAnswers).forEach(([questionId, selected]) => {
      mergedAnswers[questionId] = selected?.[0] ?? "";
    });

    Object.entries(descriptiveAnswers).forEach(([questionId, value]) => {
      mergedAnswers[questionId] = value;
    });

    return {
      remaining_seconds: Math.max(0, lastSyncedRemainingRef.current || remainingSeconds),
      current_index: currentIndex,
      answers: mergedAnswers,
      flagged: flaggedMap,
    };
  }, [
    objectiveAnswers,
    descriptiveAnswers,
    remainingSeconds,
    currentIndex,
    flaggedMap,
  ]);

  const handlePauseExam = useCallback(async () => {
    if (!examId || submittingRef.current) return;

    try {
      setSubmitting(true);
      setError(null);
      syncCurrentQuestionTime();

      await pauseExam(examId, buildPausePayload());
      allowNavigationRef.current = true;
      stopTimer();
      router.replace("/exams/history");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to pause exam."));
    } finally {
      setSubmitting(false);
      setShowLeaveModal(false);
    }
  }, [examId, buildPausePayload, router, syncCurrentQuestionTime, stopTimer]);

  const handleCancelExam = useCallback(async () => {
    if (!examId || submittingRef.current) return;

    try {
      setSubmitting(true);
      setError(null);
      await cancelExam(examId);
      allowNavigationRef.current = true;
      stopTimer();
      router.replace("/exams/history");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to cancel exam."));
    } finally {
      setSubmitting(false);
      setShowLeaveModal(false);
    }
  }, [examId, router, stopTimer]);

  const handleLeaveAction = useCallback(
    async (action: LeaveAction) => {
      if (action === "pause") {
        await handlePauseExam();
        return;
      }

      if (action === "cancel") {
        await handleCancelExam();
        return;
      }

      await handleSubmitExam();
    },
    [handlePauseExam, handleCancelExam, handleSubmitExam],
  );

  const closeLeaveModal = useCallback(() => {
    setShowLeaveModal(false);
    setPendingBackNavigation(false);
  }, []);

  useEffect(() => {
    loadExam();
    return () => stopTimer();
  }, [loadExam, stopTimer]);

  useEffect(() => {
    if (loading || !questions.length) return;
    if (timerMode === "per_question") return;
    startTimerLoop();
    return () => stopTimer();
  }, [loading, questions.length, timerMode, startTimerLoop, stopTimer]);

  useEffect(() => {
    if (
      !loading &&
      questions.length > 0 &&
      remainingSeconds === 0 &&
      !autoSubmittedRef.current &&
      !submittingRef.current
    ) {
      autoSubmittedRef.current = true;
      void handleSubmitExam();
    }
  }, [remainingSeconds, loading, questions.length, handleSubmitExam]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      window.history.pushState({ examGuard: true }, "", window.location.href);
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      if (allowNavigationRef.current) return;
      setPendingBackNavigation(true);
      setShowLeaveModal(true);
      window.history.pushState({ examGuard: true }, "", window.location.href);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    questionEnterTimestampRef.current = Date.now();
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showLeaveModal) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToQuestion(currentIndex + 1);
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToQuestion(currentIndex - 1);
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        handleToggleFlag();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, showLeaveModal, goToQuestion, handleToggleFlag]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">Loading exam...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Unable to load exam
          </h1>
          <p className="mt-3 text-sm text-slate-600">{error}</p>
          <button
            onClick={loadExam}
            className="mt-6 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentQ = currentQuestion;

  if (!currentQ) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            No questions found
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            We couldn&apos;t load valid questions for this exam.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Exam Workspace
            </h1>
            <p className="text-sm text-slate-500">
              Question {currentIndex + 1}/{questions.length}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              {formatTime(remainingSeconds)}
            </div>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Exit options
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Question {currentIndex + 1}
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {currentQ.question_type === "objective"
                    ? "Multiple Choice"
                    : "Descriptive"}
                </h2>
              </div>

              <button
                onClick={handleToggleFlag}
                className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                  flaggedMap[currentQ.id]
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {flaggedMap[currentQ.id] ? "Marked for review" : "Mark for review"}
              </button>
            </div>
          </div>

          <div className="px-6 py-8">
            {error ? (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <p className="mb-8 whitespace-pre-wrap text-lg leading-8 text-slate-800">
              {currentQ.question_text}
            </p>

            {currentQ.question_type === "objective" ? (
              <div className="space-y-4">
                {currentQ.options.map((option) => {
                  const checked =
                    (objectiveAnswers[currentQ.id] ?? []).includes(option.id);

                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-start gap-4 rounded-2xl border px-5 py-4 transition ${
                        checked
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQ.id}`}
                        checked={checked}
                        onChange={() =>
                          handleSelectObjective(currentQ.id, option.id)
                        }
                        className="mt-1 h-4 w-4"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Option
                        </p>
                        <p className="mt-1 text-base text-slate-800">
                          {option.text}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div>
                <textarea
                  value={descriptiveAnswers[currentQ.id] ?? ""}
                  onChange={(e) =>
                    handleDescriptiveChange(currentQ.id, e.target.value)
                  }
                  placeholder="Write your answer here..."
                  className="min-h-[220px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-900"
                />
                <p className="mt-3 text-xs text-slate-500">
                  Write clearly and keep your answer focused on the question.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-5">
            <button
              onClick={() => goToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLeaveModal(true)}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700"
              >
                Pause / Exit
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => goToQuestion(currentIndex + 1)}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmitExam}
                  disabled={submitting}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Exam"}
                </button>
              )}
            </div>
          </div>
        </main>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">
            Question Palette
          </h3>

          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <div className="font-semibold text-slate-900">{answeredCount}</div>
              <div className="text-xs text-slate-500">Answered</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <div className="font-semibold text-slate-900">{reviewCount}</div>
              <div className="text-xs text-slate-500">Review</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <div className="font-semibold text-slate-900">{pendingCount}</div>
              <div className="text-xs text-slate-500">Pending</div>
            </div>
          </div>

          <div className="mt-6 grid max-h-[420px] grid-cols-5 gap-3 overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered =
                q.question_type === "objective"
                  ? (objectiveAnswers[q.id]?.length ?? 0) > 0
                  : (descriptiveAnswers[q.id] ?? "").trim().length > 0;
              const isFlagged = flaggedMap[q.id] ?? false;

              let buttonClass =
                "border-slate-200 bg-white text-slate-700 hover:border-slate-300";

              if (isCurrent) {
                buttonClass = "border-slate-900 bg-slate-900 text-white";
              } else if (isFlagged) {
                buttonClass = "border-amber-300 bg-amber-50 text-amber-700";
              } else if (isAnswered) {
                buttonClass = "border-emerald-300 bg-emerald-50 text-emerald-700";
              }

              return (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(idx)}
                  className={`rounded-xl border px-0 py-3 text-sm font-medium transition ${buttonClass}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-2 text-xs text-slate-500">
            <p>
              <span className="font-medium text-slate-700">Shortcuts:</span>{" "}
              Left / Right arrows to move.
            </p>
            <p>
              <span className="font-medium text-slate-700">Shortcut:</span>{" "}
              Press F to mark review.
            </p>
          </div>

          <button
            onClick={handleSubmitExam}
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit Exam"}
          </button>
        </aside>
      </div>

      {showLeaveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">
              Leave exam?
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              You can pause and resume from History, submit now, or cancel this
              exam. Cancelling removes all attempt details and keeps only exam
              metadata.
            </p>

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => void handleLeaveAction("pause")}
                disabled={submitting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
              >
                Pause Exam
              </button>

              <button
                onClick={() => void handleLeaveAction("submit")}
                disabled={submitting}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white"
              >
                Submit Exam
              </button>

              <button
                onClick={() => void handleLeaveAction("cancel")}
                disabled={submitting}
                className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-medium text-white"
              >
                Cancel Exam
              </button>

              <button
                onClick={closeLeaveModal}
                disabled={submitting}
                className="rounded-xl px-4 py-3 text-sm font-medium text-slate-500"
              >
                Continue Exam
              </button>
            </div>

            {pendingBackNavigation ? (
              <p className="mt-4 text-xs text-slate-400">
                Back navigation was paused until you choose an action.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}