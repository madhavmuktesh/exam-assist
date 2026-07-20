export interface ExamCreateFormValues {
  title: string;
  source_type: "pdf" | "topic" | "questions_pdf";
  input_mode: "generate_from_content" | "extract_existing_questions";
  difficulty: "easy" | "medium" | "hard";
  objective_count: number;
  descriptive_count: number;
  options_count: number;
  timer_mode: "full_exam" | "per_section" | "per_question";
  total_duration_minutes: number | null;
  question_time_seconds: number | null;
  topic_name: string | null;
  instructions: string | null;
}

export const defaultExamFormValues: ExamCreateFormValues = {
  title: "",
  source_type: "topic",
  input_mode: "generate_from_content",
  difficulty: "medium",
  objective_count: 10,
  descriptive_count: 0,
  options_count: 4,
  timer_mode: "full_exam",
  total_duration_minutes: 30,
  question_time_seconds: null,
  topic_name: null,
  instructions: null,
};