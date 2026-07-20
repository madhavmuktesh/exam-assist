import { useState, useCallback } from "react";
import { getExam, type ExamResponse } from "@/features/exams/api";

export function useExamStatus(examId: string) {
  const [exam, setExam] = useState<ExamResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getExam(examId);
      setExam(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch exam status");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  return { exam, loading, error, refresh };
}