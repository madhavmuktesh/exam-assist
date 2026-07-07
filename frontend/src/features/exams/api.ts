// frontend/src/features/exam/api.ts
import api from "@/lib/apiClient";

// These types are aligned with your exams.py and responses.py.

// Basic enums – adjust values to match your backend if needed.
export type SourceType = "topic_pdf" | "question_pdf";
export type InputMode = "pdf";
export type Difficulty = "easy" | "medium" | "hard";
export type TimerMode = "single" | "per_question" | "per_section";

export interface SectionTimer {
  section_name: string;
  duration_minutes: number;
}

// Payload used to call POST /api/v1/exams (ExamCreateRequest)
export interface ExamCreatePayload {
  title: string;
  source_type: SourceType;
  input_mode: InputMode;
  difficulty: Difficulty;
  objective_count: number;
  descriptive_count: number;
  options_count: number;
  timer_mode: TimerMode;
  total_duration_minutes: number | null;
  section_timers: SectionTimer[];
  question_time_seconds: number | null;
  pdf_filename: string | null;
  topic_name: string | null;
  instructions: string | null;
}

// Response shape from serialize_exam (ExamResponse)
export interface ExamResponse {
  id: string;
  user_id: string;
  title: string;
  source_type: string;
  input_mode: string;
  pdf_filename: string | null;
  topic_name: string | null;
  instructions: string | null;
  difficulty: string;
  objective_count: number;
  descriptive_count: number;
  total_questions: number;
  options_count: number;
  timer_mode: string;
  total_duration_minutes: number | null;
  section_timers: SectionTimer[];
  question_time_seconds: number | null;
  status: string;
  generation_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prepared_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
}

// List response from GET /api/v1/exams
export interface ExamListResponse {
  exams: ExamResponse[];
}

// Submit payload is already defined in backend as ExamSubmitRequest,
// but for the frontend we can just send an array of answers.
export type QuestionType = "objective" | "descriptive";

export interface QuestionResponseSubmitItem {
  question_id: string;
  question_type: QuestionType;
  selected_option_ids: string[];
  descriptive_answer?: string | null;
  time_taken_seconds?: number | null;
  is_flagged_for_review: boolean;
}

export interface ExamSubmitRequest {
  answers: QuestionResponseSubmitItem[];
}

// ResultResponse matches what serialize_result returns.
export interface AnswerBreakdownItem {
  question_id: string;
  question_type: QuestionType;
  question_text: string;
  marks: number;
  obtained_marks: number;
  is_attempted: boolean;
  is_correct: boolean | null;
  selected_option_ids: string[];
  correct_option_ids: string[];
  options: { id: string; text: string }[];
  descriptive_answer: string | null;
  correct_answer_text: string | null;
  explanation?: string | null;
  review_required: boolean;
}

export interface ExamResultResponse {
  id: string;
  exam_id: string;
  user_id: string;
  total_questions: number;
  attempted_questions: number;
  objective_total: number;
  objective_attempted: number;
  objective_correct: number;
  objective_wrong: number;
  descriptive_total: number;
  descriptive_attempted: number;
  max_marks: number;
  objective_score: number;
  descriptive_score: number;
  final_score: number;
  percentage: number;
  status: string;
  review_required: boolean;
  answer_breakdown: AnswerBreakdownItem[];
  created_at: string;
  updated_at: string;
}

// ---- Actual API calls ----

// Create exam: POST /api/v1/exams
export async function createExam(payload: ExamCreatePayload): Promise<ExamResponse> {
  const res = await api.post<ExamResponse>("/exams", payload);
  return res.data;
}

// List exams: GET /api/v1/exams
export async function listExams(): Promise<ExamListResponse> {
  const res = await api.get<ExamListResponse>("/exams");
  return res.data;
}

// Get one exam: GET /api/v1/exams/{exam_id}
export async function getExam(examId: string): Promise<ExamResponse> {
  const res = await api.get<ExamResponse>(`/exams/${examId}`);
  return res.data;
}

// Submit responses: POST /api/v1/responses/exam/{exam_id}/submit
export async function submitExamResponses(
  examId: string,
  payload: ExamSubmitRequest,
): Promise<ExamResultResponse> {
  const res = await api.post<ExamResultResponse>(
    `/responses/exam/${examId}/submit`,
    payload,
  );
  return res.data;
}

// Get stored responses: GET /api/v1/responses/exam/{exam_id}
export async function getExamResponses(examId: string) {
  const res = await api.get(`/responses/exam/${examId}`);
  return res.data; // ResponseListResponse
}

// Get exam result with breakdown: GET /api/v1/responses/exam/{exam_id}/result
export async function getExamResult(examId: string): Promise<ExamResultResponse> {
  const res = await api.get<ExamResultResponse>(`/responses/exam/${examId}/result`);
  return res.data;
}