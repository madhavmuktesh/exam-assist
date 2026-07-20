import api from "@/lib/apiClient";

export type QuestionType = "objective" | "descriptive";
export type SourceType = "pdf" | "topic" | "questions_pdf";
export type Difficulty = "easy" | "medium" | "hard";
export type TimerMode = "full_exam" | "per_section" | "per_question";
export type QuestionPreparationMode =
  | "generate_from_content"
  | "extract_existing_questions";

export type ExamStatus =
  | "draft"
  | "ready"
  | "in_progress"
  | "paused"
  | "cancelled"
  | "submitted"
  | "evaluated"
  | "reviewed"
  | "pending_review";

export type ResultStatus = "evaluated" | "pending_review" | "reviewed";

export interface SectionTimer {
  section_name: string;
  duration_minutes: number;
}

export interface ExamCreatePayload {
  title: string;
  source_type: SourceType;
  input_mode: QuestionPreparationMode;
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

export interface ExamResponse {
  id: string;
  user_id: string;
  title: string;
  source_type: SourceType;
  input_mode: QuestionPreparationMode;
  pdf_filename: string | null;
  topic_name: string | null;
  instructions: string | null;
  difficulty: Difficulty;
  objective_count: number;
  descriptive_count: number;
  total_questions: number;
  options_count: number;
  timer_mode: TimerMode;
  total_duration_minutes: number | null;
  section_timers: SectionTimer[];
  question_time_seconds: number | null;
  status: ExamStatus;
  generation_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prepared_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  paused_at?: string | null;
  resumed_at?: string | null;
  cancelled_at?: string | null;
}

export interface PaginatedExamListResponse {
  exams: ExamResponse[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface StudentQuestionOption {
  id: string;
  text: string;
}

export interface StudentQuestion {
  id: string;
  question_text: string;
  question_type: QuestionType;
  marks: number;
  options: StudentQuestionOption[];
}

export interface ResumePayload {
  remaining_seconds: number;
  current_index: number;
  answers: Record<string, string>;
  flagged: Record<string, boolean>;
}

export interface StartExamResponse {
  exam_id: string;
  timer_mode: TimerMode;
  total_duration_minutes: number | null;
  question_time_seconds: number | null;
  status: ExamStatus;
  resume_payload: ResumePayload | null;
  questions: StudentQuestion[];
}

export interface PauseExamPayload {
  remaining_seconds: number;
  current_index: number;
  answers: Record<string, string>;
  flagged: Record<string, boolean>;
}

export interface PauseExamResponse {
  message: string;
  exam_id: string;
  status: ExamStatus;
  paused_at: string;
}

export interface CancelExamResponse {
  message: string;
}

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

export interface StoredResponseItem {
  id: string;
  exam_id: string;
  question_id: string;
  user_id: string;
  question_type: QuestionType;
  selected_option_ids: string[];
  descriptive_answer?: string | null;
  time_taken_seconds?: number | null;
  is_flagged_for_review: boolean;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface ResponseListResponse {
  responses: StoredResponseItem[];
}

export interface AnswerBreakdownItem {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  section_name?: string | null;
  marks: number;
  obtained_marks: number;
  is_attempted?: boolean;
  is_correct: boolean | null;
  selected_option_ids: string[];
  correct_option_ids: string[];
  descriptive_answer?: string | null;
  correct_answer_text?: string | null;
  explanation?: string | null;
  review_required?: boolean;
  ai_feedback?: string | null;
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
  status: ResultStatus;
  review_required: boolean;
  answer_breakdown: AnswerBreakdownItem[];
  created_at: string;
  updated_at: string;
}

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

export async function createExam(
  payload: ExamCreatePayload,
): Promise<ExamResponse> {
  const res = await api.post<ExamResponse>("/exams", payload);
  return res.data;
}

export async function listExams(
  page = 1,
  limit = 10,
): Promise<PaginatedExamListResponse> {
  const res = await api.get<PaginatedExamListResponse>("/exams", {
    params: { page, limit },
  });
  return res.data;
}

export async function getExam(examId: string): Promise<ExamResponse> {
  const res = await api.get<ExamResponse>(`/exams/${examId}`);
  return res.data;
}

export async function startExam(examId: string): Promise<StartExamResponse> {
  const res = await api.post<StartExamResponse>(`/exams/${examId}/start`);
  return res.data;
}

export async function pauseExam(
  examId: string,
  payload: PauseExamPayload,
): Promise<PauseExamResponse> {
  const res = await api.post<PauseExamResponse>(
    `/exams/${examId}/pause`,
    payload,
  );
  return res.data;
}

export async function cancelExam(
  examId: string,
): Promise<CancelExamResponse> {
  const res = await api.post<CancelExamResponse>(`/exams/${examId}/cancel`);
  return res.data;
}

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

export async function getExamResponses(
  examId: string,
): Promise<ResponseListResponse> {
  const res = await api.get<ResponseListResponse>(`/responses/exam/${examId}`);
  return res.data;
}

export async function getExamResult(
  examId: string,
): Promise<ExamResultResponse> {
  const res = await api.get<ExamResultResponse>(
    `/responses/exam/${examId}/result`,
  );
  return res.data;
}

export async function getExamHistory(): Promise<ExamHistoryResponse> {
  const res = await api.get<ExamHistoryResponse>("/history");
  return res.data;
}

export async function deleteExamResult(examId: string): Promise<void> {
  await api.delete(`/responses/exam/${examId}/result`);
}