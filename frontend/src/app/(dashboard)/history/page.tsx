// frontend/src/app/(dashboard)/history/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getExamHistory } from "@/features/exam/api";

interface HistoryItem {
  exam_id: string;
  title: string;
  attempted_at: string;
  score: number;
}

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getExamHistory();
        setItems(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8">Loading history...</div>;

  if (!items.length)
    return <div className="p-8">No exam history yet. Create your first exam!</div>;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-4">Exam history</h1>
      <div className="divide-y border rounded">
        {items.map((item) => (
          <div
            key={item.exam_id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-gray-500">
                Attempted: {new Date(item.attempted_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">Score: {item.score}</span>
              <button
                className="text-blue-600 underline text-sm"
                onClick={() => router.push(`/exams/${item.exam_id}/result`)}
              >
                View result
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}