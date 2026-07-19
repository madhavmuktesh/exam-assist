"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listExams } from "@/features/exams/api";
import type {
  ExamResponse,
  PaginatedExamListResponse,
} from "@/features/exams/api";

function statusLabel(exam: ExamResponse) {
  switch (exam.status) {
    case "submitted":
    case "evaluated":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "paused":
      return "Paused";
    case "ready":
      return "Ready";
    case "cancelled":
      return "Cancelled";
    default:
      return "Draft";
  }
}

function generationBadge(exam: ExamResponse) {
  switch (exam.generation_status) {
    case "completed":
      return (
        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
          Questions ready
        </span>
      );
    case "failed":
      return (
        <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">
          Generation failed
        </span>
      );
    case "not_applicable":
      return (
        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
          Manual questions
        </span>
      );
    default:
      return (
        <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-700">
          Generating...
        </span>
      );
  }
}

function getExamActionHref(exam: ExamResponse) {
  if (exam.status === "paused" || exam.status === "in_progress") {
    return `/exams/${exam.id}/start`;
  }

  if (exam.status === "submitted" || exam.status === "evaluated") {
    return `/exams/${exam.id}/result`;
  }

  return `/exams/${exam.id}/ready`;
}

function getExamActionLabel(exam: ExamResponse) {
  if (exam.status === "paused") return "Resume";
  if (exam.status === "in_progress") return "Continue";
  if (exam.status === "submitted" || exam.status === "evaluated") {
    return "View result";
  }
  return "Open";
}

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res: PaginatedExamListResponse = await listExams();
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
        <h1 className="mb-4 text-xl font-semibold">Your exams</h1>
        <p>No exams created yet.</p>
        <Link
          href="/exams/create"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white"
        >
          Create an exam
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your exams</h1>
        <Link
          href="/exams/create"
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          New exam
        </Link>
      </div>

      <div className="overflow-hidden rounded border">
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
                    href={getExamActionHref(exam)}
                    className="text-blue-600 hover:underline"
                  >
                    {getExamActionLabel(exam)}
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