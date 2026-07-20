import { EXAM_STATUS_LABELS, DIFFICULTY_LABELS, TIMER_MODE_LABELS } from "@/lib/constants";

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function getExamStatusLabel(status: string): string {
  return EXAM_STATUS_LABELS[status] ?? status;
}

export function getDifficultyLabel(difficulty: string): string {
  return DIFFICULTY_LABELS[difficulty] ?? difficulty;
}

export function getTimerModeLabel(mode: string): string {
  return TIMER_MODE_LABELS[mode] ?? mode;
}

export function getScoreColor(percentage: number): string {
  if (percentage >= 75) return "text-green-600";
  if (percentage >= 50) return "text-yellow-600";
  return "text-red-600";
}

export function truncate(str: string, maxLength = 60): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}