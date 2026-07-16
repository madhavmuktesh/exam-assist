// frontend/src/app/(dashboard)/exams/[examId]/ready/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getExam } from "@/features/exams/api";
import type { ExamResponse } from "@/features/exams/api";

interface PageProps {
  params: Promise<{ examId: string }>;
}

export default function ExamReadyPage({ params }: PageProps) {
  // Next.js 16: params is a Promise, unwrap it with React.use()
  const { examId } = use(params);

  const router = useRouter();
  const [exam, setExam] = useState<ExamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getExam(examId);
        setExam(data);
      } catch (err: any) {
        console.error("Load exam error:", err?.response?.data ?? err);
        let message = "Failed to load exam.";
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

  if (loading) return <div className="p-8">Loading exam...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!exam) return <div className="p-8">Exam not found.</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-semibold mb-2">{exam.title}</h1>

      <div className="border rounded p-4 space-y-1 text-sm">
        <p>
          <span className="font-medium">Difficulty:</span>{" "}
          {exam.difficulty}
        </p>
        <p>
          <span className="font-medium">Questions:</span>{" "}
          {exam.total_questions} (MCQ {exam.objective_count}, descriptive{" "}
          {exam.descriptive_count})
        </p>
        <p>
          <span className="font-medium">Timer mode:</span>{" "}
          {exam.timer_mode}
        </p>
        {exam.total_duration_minutes && (
          <p>
            <span className="font-medium">Duration:</span>{" "}
            {exam.total_duration_minutes} minutes
          </p>
        )}
        {exam.instructions && (
          <p className="mt-2">
            <span className="font-medium">Instructions:</span>{" "}
            {exam.instructions}
          </p>
        )}
      </div>

      <button
        onClick={() => router.push(`/exams/${exam.id}/start`)}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        Start exam
      </button>
    </div>
  );
}