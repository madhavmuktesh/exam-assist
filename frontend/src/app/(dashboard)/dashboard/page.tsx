"use client";

import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Exam Assistant Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border rounded p-4 space-y-2 bg-white">
          <h2 className="font-medium text-lg">Create exam</h2>
          <p className="text-sm text-gray-600">
            Upload a topic or question-paper PDF and generate a configurable
            timed exam.
          </p>
          <button
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => router.push("/exams/create")}
          >
            Create exam
          </button>
        </div>

        <div className="border rounded p-4 space-y-2 bg-white">
          <h2 className="font-medium text-lg">Exam history</h2>
          <p className="text-sm text-gray-600">
            Review your past exams, scores, and performance trends.
          </p>
          <button
            className="mt-2 px-4 py-2 bg-gray-800 text-white rounded"
            onClick={() => router.push("/history")}
          >
            View history
          </button>
        </div>
      </div>
    </div>
  );
}