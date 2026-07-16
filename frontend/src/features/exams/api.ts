// frontend/src/features/exam/api.ts
import api from "@/lib/apiClient";

// Shared enums / literal types
export type QuestionType = "objective" | "descriptive";

export type InputMode =
  | "pdf"
  | "topic"
  | "questions_pdf"; // how the input is provided

export type SourceType =
  | "pdf"
  | "topic"
  | "questions_pdf"; // how the exam source is classified

export type Difficulty = "easy" | "medium" | "hard";

export type TimerMode = "full_exam" | "per_section" | "per_question";

// How questions should be prepared for the exam
export type QuestionPreparationMode =
  | "generate_from_content"
  | "extract_existing_questions";

// Section timers
export interface SectionTimer {
  section_name: string;
  duration_minutes: number;
}

// ----- Exam creation / listing -----

// Payload used for POST /api/v1/exams (ExamCreateRequest)
export interface ExamCreatePayload {
  title: string;
  source_type: SourceType; // e.g. "pdf"
  input_mode: QuestionPreparationMode; // "generate_from_content" or "extract_existing_questions"
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

// ExamResponse from serialize_exam in exams.py
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

export interface ExamListResponse {
  exams: ExamResponse[];
}

// Create exam: POST /api/v1/exams
export async function createExam(
  payload: ExamCreatePayload,
): Promise<ExamResponse> {
  const res = await api.post<ExamResponse>("/exams", payload);
  return res.data;
}

// List exams: GET /api/v1/exams
export async function listExams(): Promise<ExamListResponse> {
  const res = await api.get<ExamListResponse>("/exams");
  return res.data;
}

// Get exam: GET /api/v1/exams/{exam_id}
export async function getExam(examId: string): Promise<ExamResponse> {
  const res = await api.get<ExamResponse>(`/exams/${examId}`);
  return res.data;
}

// ----- Student questions (exam start) -----

// Student question shape from questions.py serialize_student_question
export interface StudentQuestion {
  id: string;
  exam_id: string;
  question_type: QuestionType; // "objective" | "descriptive"
  question_text: string;
  question_order: number;
  marks: number;
  options: { id: string; text: string }[];
  section_name?: string | null;
  difficulty?: string | null;
  time_limit_seconds?: number | null;
}

export interface StudentQuestionListResponse {
  questions: StudentQuestion[];
}

// GET /api/v1/questions/exam/{exam_id}/start
export async function startExamQuestions(
  examId: string,
): Promise<StudentQuestionListResponse> {
  const res = await api.get<StudentQuestionListResponse>(
    `/questions/exam/${examId}/start`,
  );
  return res.data;
}

// ----- Exam submission & results -----

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

// ResultResponse (current serialize_result / score_exam output)
export interface AnswerBreakdownItem {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  section_name?: string | null;
  marks: number;
  marks_obtained: number;
  is_correct: boolean;
  selected_option_ids: string[];
  correct_option_ids: string[];
  descriptive_answer?: string | null;
  correct_answer_text?: string | null;
  explanation?: string | null;
}

export interface ExamResultResponse {
  exam_id: string;
  user_id: string;
  total_marks: number;
  marks_obtained: number;
  percentage: number;
  pass_fail_status: "pass" | "fail";
  attempted_question_count: number;
  correct_answer_count: number;
  incorrect_answer_count: number;
  skipped_question_count: number;
  answer_breakdown: AnswerBreakdownItem[];
}

// Get exam result with breakdown: GET /api/v1/responses/exam/{exam_id}/result
export async function getExamResult(
  examId: string,
): Promise<ExamResultResponse> {
  const res = await api.get<ExamResultResponse>(
    `/responses/exam/${examId}/result`,
  );
  return res.data;
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

// GET /api/v1/responses/history
export async function getExamHistory(): Promise<ExamHistoryResponse> {
  const res = await api.get<ExamHistoryResponse>("/responses/history");
  return res.data;
}