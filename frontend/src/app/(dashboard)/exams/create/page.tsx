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
  SectionTimer,
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

  const [sectionTimers, setSectionTimers] = useState<SectionTimer[]>([
    { section_name: "Section A", duration_minutes: 30 },
    { section_name: "Section B", duration_minutes: 30 },
  ]);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateSectionTimer(
    index: number,
    field: keyof SectionTimer,
    value: string | number,
  ) {
    setSectionTimers((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addSectionTimer() {
    setSectionTimers((prev) => [
      ...prev,
      {
        section_name: `Section ${String.fromCharCode(65 + prev.length)}`,
        duration_minutes: 15,
      },
    ]);
  }

  function removeSectionTimer(index: number) {
    setSectionTimers((prev) => prev.filter((_, i) => i !== index));
  }

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

    if (objectiveCount + descriptiveCount <= 0) {
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

    if (timerMode === "per_section") {
      const hasInvalidSection = sectionTimers.length === 0 || sectionTimers.some(
        (section) =>
          !section.section_name.trim() || section.duration_minutes <= 0,
      );

      if (hasInvalidSection) {
        setError("Please provide valid section names and durations.");
        return;
      }
    }

    setLoading(true);

    try {
      let pdfFilename: string | null = null;

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

      const payload: ExamCreatePayload = {
        title: title.trim(),
        source_type: sourceType,
        input_mode: inputMode,
        difficulty,
        objective_count: objectiveCount,
        descriptive_count: descriptiveCount,
        options_count: optionsCount,
        timer_mode: timerMode,
        total_duration_minutes:
          timerMode === "full_exam" ? durationMinutes : null,
        section_timers:
          timerMode === "per_section" ? sectionTimers : [],
        question_time_seconds:
          timerMode === "per_question" ? questionTimeSeconds : null,
        pdf_filename: pdfFilename,
        topic_name: null,
        instructions: instructions.trim() || null,
      };

      const exam = await createExam(payload);
      router.push(`/exams/${exam.id}`);
    } catch (err: any) {
      const message = getApiErrorMessage(err);
      console.error("Create exam error:", err?.response?.data ?? err);

      if (
        message.toLowerCase().includes("insufficient_quota") ||
        message.toLowerCase().includes("quota") ||
        message.toLowerCase().includes("429")
      ) {
        setError(
          "AI question generation is temporarily unavailable because the API quota is exhausted. Please try again later or switch to extracting existing questions.",
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-4">Create Exam</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div>
          <label className="block text-sm font-medium mb-1">
            Question preparation
          </label>
          <div className="flex flex-col gap-2">
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

        {sourceType === "pdf" && (
          <div>
            <label className="block text-sm font-medium mb-1">PDF file</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full"
            />
          </div>
        )}

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
            <label className="block text-sm mb-1">Options per question</label>
            <input
              type="number"
              min={2}
              max={6}
              value={optionsCount}
              onChange={(e) => setOptionsCount(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {timerMode === "full_exam" && (
            <div>
              <label className="block text-sm mb-1">Duration (minutes)</label>
              <input
                type="number"
                min={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          )}

          {timerMode === "per_question" && (
            <div>
              <label className="block text-sm mb-1">
                Time per question (seconds)
              </label>
              <input
                type="number"
                min={5}
                value={questionTimeSeconds}
                onChange={(e) => setQuestionTimeSeconds(Number(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          )}
        </div>

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

        {timerMode === "per_section" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">Section timers</label>
              <button
                type="button"
                onClick={addSectionTimer}
                className="px-3 py-1 text-sm border rounded"
              >
                Add section
              </button>
            </div>

            {sectionTimers.map((section, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={section.section_name}
                  onChange={(e) =>
                    updateSectionTimer(index, "section_name", e.target.value)
                  }
                  placeholder="Section name"
                  className="w-full border rounded px-3 py-2"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={section.duration_minutes}
                    onChange={(e) =>
                      updateSectionTimer(
                        index,
                        "duration_minutes",
                        Number(e.target.value),
                      )
                    }
                    placeholder="Minutes"
                    className="w-full border rounded px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => removeSectionTimer(index)}
                    className="px-3 py-2 border rounded text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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

        {error && <p className="text-sm text-red-600">{error}</p>}

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