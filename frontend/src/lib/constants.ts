export const APP_NAME = "Exam Assist";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const TOKEN_KEYS = {
  ACCESS: "access_token",
  REFRESH: "refresh_token",
} as const;

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  EXAMS: "/exams",
  HISTORY: "/history",
  PROFILE: "/profile",
} as const;

export const EXAM_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  in_progress: "In Progress",
  paused: "Paused",
  cancelled: "Cancelled",
  submitted: "Submitted",
  evaluated: "Evaluated",
  reviewed: "Reviewed",
  pending_review: "Pending Review",
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const TIMER_MODE_LABELS: Record<string, string> = {
  full_exam: "Full Exam Timer",
  per_section: "Per Section Timer",
  per_question: "Per Question Timer",
};