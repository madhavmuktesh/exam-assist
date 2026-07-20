"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/apiClient";
import {
  createExam,
  ExamCreatePayload,
  Difficulty,
  TimerMode,
  QuestionPreparationMode,
  SourceType,
} from "@/features/exams/api";

export default function CreateExamPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);

  const [sourceType] = useState<SourceType>("pdf");
  const [inputMode, setInputMode] =
    useState<QuestionPreparationMode>("generate_from_content");

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [objectiveCount, setObjectiveCount] = useState(20);
  const [descriptiveCount, setDescriptiveCount] = useState(5);
  const [optionsCount, setOptionsCount] = useState(4);

  const [timerMode, setTimerMode] = useState<TimerMode>("full_exam");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [questionTimeSeconds, setQuestionTimeSeconds] = useState<number>(60);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>("");

  const [customizeExtraction, setCustomizeExtraction] = useState(false);

  const isExtractMode = inputMode === "extract_existing_questions";
  const shouldDisableSettings = isExtractMode && !customizeExtraction;

  function getApiErrorMessage(err: any) {
    const data = err?.response?.data;
    if (!data) return "Failed to create exam.";
    if (typeof data === "string") return data;
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      const first = data.detail[0];
      if (typeof first?.msg === "string") return first.msg;
    }
    return "Failed to create exam.";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please enter an exam title.");
      return;
    }

    if (sourceType === "pdf" && !file) {
      setError("Please upload a PDF file for this exam.");
      return;
    }

    if (!shouldDisableSettings && objectiveCount + descriptiveCount <= 0) {
      setError("Please request at least one question.");
      return;
    }

    if (timerMode === "full_exam" && durationMinutes <= 0) {
      setError("Please enter a valid exam duration.");
      return;
    }

    if (timerMode === "per_question" && questionTimeSeconds <= 0) {
      setError("Please enter a valid per-question time.");
      return;
    }

    setLoading(true);

    try {
      let pdfFilename: string | null = null;

      if (sourceType === "pdf" && file) {
        setUploadStep("Uploading PDF file...");
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await api.post<{ pdf_filename: string }>(
          "/files/upload-pdf",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );

        pdfFilename = uploadRes.data.pdf_filename;
      }

      setUploadStep(
        inputMode === "generate_from_content"
          ? "Generating AI questions from content..."
          : "Extracting questions from paper..."
      );

      const payload: ExamCreatePayload = {
        title: title.trim(),
        source_type: sourceType,
        input_mode: inputMode,
        difficulty,
        objective_count: shouldDisableSettings ? 150 : objectiveCount,
        descriptive_count: shouldDisableSettings ? 50 : descriptiveCount,
        options_count: shouldDisableSettings ? 4 : optionsCount,
        timer_mode: timerMode,
        total_duration_minutes: timerMode === "full_exam" ? durationMinutes : null,
        section_timers: [],
        question_time_seconds:
          timerMode === "per_question" ? questionTimeSeconds : null,
        pdf_filename: pdfFilename,
        topic_name: null,
        instructions: instructions.trim() || null,
      };

      const exam = await createExam(payload);
      router.push(`/exams/${exam.id}/ready`);
    } catch (err: any) {
      const message = getApiErrorMessage(err);
      if (
        message.toLowerCase().includes("insufficient_quota") ||
        message.toLowerCase().includes("429")
      ) {
        setError(
          "AI question generation is temporarily unavailable because the API quota is exhausted. Please try again later or switch to extracting existing questions.",
        );
      } else {
        setError(message);
      }
      setLoading(false);
      setUploadStep("");
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-800">Create Exam</h1>
          <p className="text-slate-500 text-sm">
            Upload your source PDF, choose how questions should be prepared, and
            configure timing and difficulty settings.
          </p>
        </div>

        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-500 font-medium">Source</p>
            <p className="text-base font-semibold text-slate-800 uppercase">
              {sourceType}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500 font-medium">Mode</p>
            <p className="text-base font-semibold text-slate-800">
              {inputMode === "generate_from_content"
                ? "Generate"
                : "Extract"}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500 font-medium">Timer</p>
            <p className="text-base font-semibold text-slate-800">
              {timerMode === "full_exam" ? "Full Exam" : "Per Question"}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500 font-medium">Difficulty</p>
            <p className="text-base font-semibold text-slate-800 capitalize">
              {difficulty}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800">Basic Details</h2>
            <p className="text-sm text-slate-500">
              Set the exam title and provide optional instructions for the learner.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Exam Title
            </label>
            <input
              type="text"
              disabled={loading}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter exam title"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Instructions (optional)
            </label>
            <textarea
              rows={4}
              disabled={loading}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Add any special instructions, rules, or notes for this exam"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none resize-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800">Question Source</h2>
            <p className="text-sm text-slate-500">
              Choose whether to generate questions from content or extract them from
              an existing question paper.
            </p>
          </div>

          <div className="grid gap-3">
            <label
              className={`rounded-xl border px-4 py-4 cursor-pointer transition ${
                inputMode === "generate_from_content"
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  disabled={loading}
                  checked={inputMode === "generate_from_content"}
                  onChange={() => {
                    setInputMode("generate_from_content");
                    setCustomizeExtraction(false);
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-slate-800">
                    Generate from content
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Best for topic notes, textbook material, or course PDFs.
                  </p>
                </div>
              </div>
            </label>

            <label
              className={`rounded-xl border px-4 py-4 cursor-pointer transition ${
                inputMode === "extract_existing_questions"
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  disabled={loading}
                  checked={inputMode === "extract_existing_questions"}
                  onChange={() => setInputMode("extract_existing_questions")}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-slate-800">
                    Extract existing questions
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Best for question-paper PDFs where questions already exist.
                  </p>
                </div>
              </div>
            </label>
          </div>

          {isExtractMode && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <label className="flex items-start gap-3 text-sm text-amber-800 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={loading}
                  checked={customizeExtraction}
                  onChange={(e) => setCustomizeExtraction(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  Customize extraction limits to override the default auto-extract
                  values.
                </span>
              </label>
            </div>
          )}

          {sourceType === "pdf" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                PDF File
              </label>
              <input
                type="file"
                disabled={loading}
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 disabled:opacity-50"
              />
              {file && (
                <p className="mt-2 text-sm text-slate-500">
                  Selected file: <span className="font-medium text-slate-700">{file.name}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800">
              Question Configuration
            </h2>
            <p className="text-sm text-slate-500">
              Set counts, options, and difficulty. Some fields are auto-managed in
              extraction mode unless customization is enabled.
            </p>
          </div>

          {shouldDisableSettings && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Extraction mode is using automatic defaults for question counts and
              options. Enable customization above to override them.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                MCQ Count
              </label>
              <input
                type="number"
                min={0}
                value={shouldDisableSettings ? "" : objectiveCount}
                onChange={(e) => setObjectiveCount(Number(e.target.value))}
                disabled={shouldDisableSettings || loading}
                placeholder={shouldDisableSettings ? "Auto-extracted" : ""}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Descriptive Count
              </label>
              <input
                type="number"
                min={0}
                value={shouldDisableSettings ? "" : descriptiveCount}
                onChange={(e) => setDescriptiveCount(Number(e.target.value))}
                disabled={shouldDisableSettings || loading}
                placeholder={shouldDisableSettings ? "Auto-extracted" : ""}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Options per Question
              </label>
              <input
                type="number"
                min={2}
                max={6}
                value={shouldDisableSettings ? "" : optionsCount}
                onChange={(e) => setOptionsCount(Number(e.target.value))}
                disabled={shouldDisableSettings || loading}
                placeholder={shouldDisableSettings ? "Auto-extracted" : ""}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                disabled={shouldDisableSettings || loading}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800">Timing Settings</h2>
            <p className="text-sm text-slate-500">
              Choose how time should be applied across the exam.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Timer Mode
            </label>
            <select
              value={timerMode}
              disabled={loading}
              onChange={(e) => setTimerMode(e.target.value as TimerMode)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
            >
              <option value="full_exam">Single exam timer</option>
              <option value="per_question">Per question</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {timerMode === "full_exam" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  disabled={loading}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />
              </div>
            )}

            {timerMode === "per_question" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Time per question (seconds)
                </label>
                <input
                  type="number"
                  min={5}
                  disabled={loading}
                  value={questionTimeSeconds}
                  onChange={(e) => setQuestionTimeSeconds(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2"
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? (uploadStep || "Creating exam...") : "Create exam"}
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            disabled={loading}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}