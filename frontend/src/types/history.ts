import type { ExamStatus } from "@/features/exams/api";

export interface ExamHistoryItem {
  exam_id: string;
  exam_title: string;
  final_score: number | null;
  max_marks: number | null;
  percentage: number | null;
  status: ExamStatus;
  created_at: string;
  updated_at: string;
}

export interface ExamHistoryResponse {
  history: ExamHistoryItem[];
}