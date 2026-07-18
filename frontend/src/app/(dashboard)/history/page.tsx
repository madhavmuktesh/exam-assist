"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getExamHistory, type ExamHistoryItem } from "@/features/exams/api";

function getApiErrorMessage(error: any, fallback = "Failed to load exam history.") {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg).filter(Boolean).join(", ");
  }

  if (detail && typeof detail === "object" && "msg" in detail) {
    return String(detail.msg);
  }

  return fallback;
}

export default function HistoryPage() {
  const [items, setItems] = useState<ExamHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getExamHistory();
        setItems(res.history);
      } catch (err: any) {
        setError(getApiErrorMessage(err, "Failed to load exam history."));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <div className="p-8">Loading history...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  if (!items.length) {
    return (
      <div className="max-w-4xl mx-auto py-8 space-y-4">
        <h1 className="text-xl font-semibold">Exam history</h1>
        <div className="border rounded p-4 bg-white">
          <p className="text-sm text-zinc-600">
            You have not completed any exams yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <h1 className="text-xl font-semibold">Exam history</h1>

      <div className="border rounded overflow-hidden bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Exam</th>
              <th className="px-4 py-2 text-left">Score</th>
              <th className="px-4 py-2 text-left">Percentage</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Completed at</th>
              <th className="px-4 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.exam_id} className="border-t">
                <td className="px-4 py-2">{item.exam_title}</td>
                <td className="px-4 py-2">
                  {item.final_score} / {item.max_marks}
                </td>
                <td className="px-4 py-2">{item.percentage.toFixed(2)}%</td>
                <td className="px-4 py-2">{String(item.status).toUpperCase()}</td>
                <td className="px-4 py-2">
                  {new Date(item.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/exams/${item.exam_id}/result`}
                    className="text-blue-600 hover:underline"
                  >
                    View result
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