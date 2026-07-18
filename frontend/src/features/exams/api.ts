import api from "@/lib/apiClient";

export type QuestionType = "objective" | "descriptive";
export type SourceType = "pdf" | "topic" | "questions_pdf";
export type Difficulty = "easy" | "medium" | "hard";
export type TimerMode = "full_exam" | "per_section" | "per_question";
export type QuestionPreparationMode =
  | "generate_from_content"
  | "extract_existing_questions";

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
  status: string;
  generation_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prepared_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
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
  exam_id: string;
  question_type: QuestionType;
  question_text: string;
  question_order: number;
  marks: number;
  options: StudentQuestionOption[];
  section_name?: string | null;
  difficulty?: string | null;
  time_limit_seconds?: number | null;
}

export interface StudentQuestionListResponse {
  questions: StudentQuestion[];
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
  status: string;
  review_required: boolean;
  answer_breakdown: AnswerBreakdownItem[];
  created_at: string;
  updated_at: string;
}

export interface ExamHistoryItem {
  exam_id: string;
  exam_title: string;
  final_score: number;
  max_marks: number;
  percentage: number;
  status: string;
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

export async function startExamQuestions(
  examId: string,
): Promise<StudentQuestionListResponse> {
  const res = await api.get<StudentQuestionListResponse>(
    `/questions/exam/${examId}/start`,
  );
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
  const res = await api.get<ExamHistoryResponse>("/responses/history");
  return res.data;
}