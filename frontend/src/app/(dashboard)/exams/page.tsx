"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listExams } from "@/features/exams/api";
import type { ExamListResponse, ExamResponse } from "@/features/exams/api";

function statusLabel(exam: ExamResponse) {
  switch (exam.status) {
    case "submitted":
      return "Completed";
    case "started":
      return "In progress";
    case "prepared":
      return "Ready";
    default:
      return "Draft";
  }
}

function generationBadge(exam: ExamResponse) {
  switch (exam.generation_status) {
    case "completed":
      return (
        <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">
          Questions ready
        </span>
      );
    case "failed":
      return (
        <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-700">
          Generation failed
        </span>
      );
    case "not_applicable":
      return (
        <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
          Manual questions
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700">
          Generating…
        </span>
      );
  }
}

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res: ExamListResponse = await listExams();
        setExams(res.exams);
      } catch (err: any) {
        console.error("Load exams error:", err?.response?.data ?? err);
        let message = "Failed to load exams.";
        if (err?.response?.data?.detail) {
          message = err.response.data.detail;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8">Loading exams...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  if (!exams.length) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-4">Your exams</h1>
        <p>No exams created yet.</p>
        <Link
          href="/exams/create"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded"
        >
          Create an exam
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Your exams</h1>
        <Link
          href="/exams/create"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          New exam
        </Link>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Difficulty</th>
              <th className="px-4 py-2 text-left">Questions</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Generation</th>
              <th className="px-4 py-2 text-left">Created at</th>
              <th className="px-4 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((exam) => (
              <tr key={exam.id} className="border-t">
                <td className="px-4 py-2">
                  <div className="flex flex-col">
                    <span className="font-medium">{exam.title}</span>
                    <span className="text-xs text-gray-500">
                      Source: {exam.source_type} · Mode: {exam.input_mode}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 capitalize">{exam.difficulty}</td>
                <td className="px-4 py-2">{exam.total_questions}</td>
                <td className="px-4 py-2">{statusLabel(exam)}</td>
                <td className="px-4 py-2">{generationBadge(exam)}</td>
                <td className="px-4 py-2">
                  {new Date(exam.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/exams/${exam.id}/ready`}
                    className="text-blue-600 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}