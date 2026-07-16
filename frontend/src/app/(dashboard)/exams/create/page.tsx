// frontend/src/app/(dashboard)/exams/create/page.tsx
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

  const [sourceType, setSourceType] = useState<SourceType>("pdf");
  const [inputMode, setInputMode] =
    useState<QuestionPreparationMode>("generate_from_content");

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [objectiveCount, setObjectiveCount] = useState(20);
  const [descriptiveCount, setDescriptiveCount] = useState(5);
  const [optionsCount, setOptionsCount] = useState(4);
  const [timerMode, setTimerMode] = useState<TimerMode>("full_exam");
  const [durationMinutes, setDurationMinutes] = useState<number | null>(60);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (sourceType === "pdf" && !file) {
      setError("Please upload a PDF file for this exam.");
      return;
    }

    setLoading(true);

    try {
      let pdfFilename: string | null = null;

      // 1) Upload the PDF first if pdf-based
      if (sourceType === "pdf" && file) {
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

      // 2) Now create exam referencing saved PDF name
      const payload: ExamCreatePayload = {
        title,
        source_type: sourceType,
        input_mode: inputMode,
        difficulty,
        objective_count: objectiveCount,
        descriptive_count: descriptiveCount,
        options_count: optionsCount,
        timer_mode: timerMode,
        total_duration_minutes: durationMinutes,
        section_timers: [],
        question_time_seconds: null,
        pdf_filename: pdfFilename, // now comes from backend
        topic_name: null,
        instructions: instructions || null,
      };

      const exam = await createExam(payload);
      router.push(`/exams/${exam.id}`);
    } catch (err: any) {
      let message = "Failed to create exam.";
      if (err?.response?.data) {
        const data = err.response.data;
        if (typeof data === "string") {
          message = data;
        } else if (typeof data?.detail === "string") {
          message = data.detail;
        } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
          message = data.detail[0]?.msg ?? message;
        }
      }
      console.error("Create exam error:", err?.response?.data ?? err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-4">Create Exam</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1">Exam title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        {/* Question preparation mode */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Question preparation
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={inputMode === "generate_from_content"}
                onChange={() => setInputMode("generate_from_content")}
              />
              <span>Generate from content (topic/course PDF)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={inputMode === "extract_existing_questions"}
                onChange={() => setInputMode("extract_existing_questions")}
              />
              <span>Extract existing questions (question-paper PDF)</span>
            </label>
          </div>
        </div>

        {/* PDF file */}
        {sourceType === "pdf" && (
          <div>
            <label className="block text-sm font-medium mb-1">
              PDF file
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full"
            />
          </div>
        )}

        {/* Counts and options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">MCQ count</label>
            <input
              type="number"
              min={0}
              value={objectiveCount}
              onChange={(e) => setObjectiveCount(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Descriptive count</label>
            <input
              type="number"
              min={0}
              value={descriptiveCount}
              onChange={(e) => setDescriptiveCount(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">
              Options per question
            </label>
            <input
              type="number"
              min={2}
              value={optionsCount}
              onChange={(e) => setOptionsCount(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={5}
              value={durationMinutes ?? 0}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm mb-1">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        {/* Timer mode */}
        <div>
          <label className="block text-sm mb-1">Timer mode</label>
          <select
            value={timerMode}
            onChange={(e) => setTimerMode(e.target.value as TimerMode)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="full_exam">Single exam timer</option>
            <option value="per_section">Per section</option>
            <option value="per_question">Per question</option>
          </select>
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-sm mb-1">
            Instructions (optional)
          </label>
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
        >
          {loading ? "Creating exam..." : "Create exam"}
        </button>
      </form>
    </div>
  );
}