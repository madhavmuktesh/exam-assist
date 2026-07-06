// frontend/src/app/(dashboard)/exams/create/page.tsx
"use client";

import { useState } from "react";
import {
  uploadSourcePdf,
  generateQuestions,
  createExamFromQuestions,
  ExamConfig,
} from "@/features/exams/api";
import { useRouter } from "next/navigation";

export default function CreateExamPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"content" | "questions">("content");
  const [config, setConfig] = useState<ExamConfig>({
    title: "",
    total_mcq: 20,
    total_descriptive: 5,
    duration_minutes: 60,
    difficulty: "medium",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please upload a PDF file.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { pipeline_id } = await uploadSourcePdf(file, mode);
      const genRes = await generateQuestions(pipeline_id, config);

      let examId: string | undefined;

      if ("exam_id" in genRes) {
        examId = genRes.exam_id;
      } else if ("questions" in genRes) {
        const exam = await createExamFromQuestions({
          title: config.title,
          questions: genRes.questions,
          duration_minutes: config.duration_minutes,
        });
        examId = exam.id ?? exam.exam_id;
      }

      if (examId) {
        router.push(`/exams/${examId}`);
      } else {
        setError("Exam created but no exam ID returned.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to create exam.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-4">Create Exam from PDF</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Exam title</label>
          <input
            type="text"
            value={config.title}
            onChange={(e) =>
              setConfig((c) => ({ ...c, title: e.target.value }))
            }
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">PDF file</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full"
            required
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "content"}
              onChange={() => setMode("content")}
            />
            <span>Topic / course PDF</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "questions"}
              onChange={() => setMode("questions")}
            />
            <span>Existing question-paper PDF</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">MCQ count</label>
            <input
              type="number"
              min={0}
              value={config.total_mcq}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  total_mcq: Number(e.target.value),
                }))
              }
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Descriptive count</label>
            <input
              type="number"
              min={0}
              value={config.total_descriptive}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  total_descriptive: Number(e.target.value),
                }))
              }
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Duration (minutes)</label>
            <input
              type="number"
              min={5}
              value={config.duration_minutes}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  duration_minutes: Number(e.target.value),
                }))
              }
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Difficulty</label>
            <select
              value={config.difficulty}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  difficulty: e.target.value as ExamConfig["difficulty"],
                }))
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
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