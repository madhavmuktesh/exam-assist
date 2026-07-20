import { useState, useEffect, useCallback } from "react";
import {
  listExams,
  getExam,
  getExamHistory,
  getExamResult,
  type ExamResponse,
  type PaginatedExamListResponse,
  type ExamHistoryResponse,
  type ExamResultResponse,
} from "@/features/exams/api";

export function useExamList(page = 1, limit = 10) {
  const [data, setData] = useState<PaginatedExamListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listExams(page, limit);
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load exams");
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export function useExam(examId: string) {
  const [exam, setExam] = useState<ExamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    setLoading(true);
    getExam(examId)
      .then(setExam)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load exam"))
      .finally(() => setLoading(false));
  }, [examId]);

  return { exam, loading, error };
}

export function useExamHistory() {
  const [data, setData] = useState<ExamHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getExamHistory()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

export function useExamResult(examId: string) {
  const [result, setResult] = useState<ExamResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    getExamResult(examId)
      .then(setResult)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load result"))
      .finally(() => setLoading(false));
  }, [examId]);

  return { result, loading, error };
}