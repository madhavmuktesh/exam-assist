// frontend/src/app/(dashboard)/exams/[examId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getExam, submitResponses } from "@/features/exam/api";
import { useRouter } from "next/navigation";

export default function TakeExamPage({ params }: { params: { examId: string } }) {
  const { examId } = params;
  const router = useRouter();

  const [exam, setExam] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getExam(examId);
      setExam(data);
      const duration = data.duration_minutes ?? 60;
      setRemainingSeconds(duration * 60);
    }
    load();
  }, [examId]);

  useEffect(() => {
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      handleSubmit();
      return;
    }
    const id = setInterval(() => {
      setRemainingSeconds((s) => (s !== null ? s - 1 : s));
    }, 1000);
    return () => clearInterval(id);
  }, [remainingSeconds]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitResponses(examId, answers);
      router.push(`/exams/${examId}/results`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!exam) return <div className="p-8">Loading exam...</div>;

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">{exam.title}</h1>
        <div className="font-mono">
          Time left:{" "}
          {remainingSeconds !== null &&
            `${Math.floor(remainingSeconds / 60)
              .toString()
              .padStart(2, "0")}:${(remainingSeconds % 60)
              .toString()
              .padStart(2, "0")}`}
        </div>
      </div>

      <div className="space-y-6">
        {exam.questions?.map((q: any, index: number) => (
          <div key={q.id ?? index} className="border rounded p-4">
            <p className="font-medium mb-2">
              Q{index + 1}. {q.text}
            </p>

            {q.type === "mcq" ? (
              <div className="space-y-1">
                {q.options.map((opt: string, i: number) => (
                  <label key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [q.id]: opt }))
                      }
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="w-full border rounded px-3 py-2"
                rows={4}
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                }
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit exam"}
        </button>
      </div>
    </div>
  );
}