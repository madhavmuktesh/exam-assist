// e.g. src/types/exam.ts
export type QuestionType = "objective" | "descriptive";

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionMeta {
  id: string;
  text: string;
  question_type: QuestionType;
  options?: QuestionOption[];
  correct_option_ids?: string[];
  correct_descriptive_answer?: string | null;
}

export interface StoredResponseView {
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

export interface QuestionResult {
  question: QuestionMeta;
  response: StoredResponseView;
  is_correct: boolean;
}

export interface ExamResult {
  exam_id: string;
  title: string;
  total_questions: number;
  correct: number;
  incorrect: number;
  blank: number;
  score: number;
  questions: QuestionResult[];
}