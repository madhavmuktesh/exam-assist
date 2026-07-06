// frontend/src/app/(dashboard)/exams/[examId]/result/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/apiClient";

interface ExamResult {
  exam_id: string;
  title: string;
  total_questions: number;
  correct: number;
  incorrect: number;
  blank: number;
  score: number;
  // add any extra fields you return, like topic_breakdown, etc.
}

export default function ExamResultPage({ params }: { params: { examId: string } }) {
  const { examId } = params;
  const router = useRouter();
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/responses/${examId}/result`);
        setResult(res.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [examId]);

  if (loading) return <div className="p-8">Loading result...</div>;
  if (!result) return <div className="p-8">No result found.</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-semibold">Exam Result</h1>
      <div className="border rounded p-4 space-y-2">
        <p className="text-lg font-medium">{result.title}</p>
        <p>Total questions: {result.total_questions}</p>
        <p>Correct: {result.correct}</p>
        <p>Incorrect: {result.incorrect}</p>
        <p>Unanswered: {result.blank}</p>
        <p className="font-semibold">Score: {result.score}</p>
      </div>

      <button
        className="px-4 py-2 bg-blue-600 text-white rounded"
        onClick={() => router.push("/dashboard")}
      >
        Back to dashboard
      </button>
    </div>
  );
}