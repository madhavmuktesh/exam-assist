"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getExamHistory, type ExamHistoryItem } from "@/features/exams/api";

function getApiErrorMessage(
  error: any,
  fallback = "Failed to load exam history.",
) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg).filter(Boolean).join(", ");
  }
  if (detail && typeof detail === "object" && "msg" in detail) {
    return String(detail.msg);
  }
  return fallback;
}

function getStatusBadgeClass(status: string) {
  const normalized = String(status).toLowerCase();
  if (["evaluated", "reviewed", "submitted"].includes(normalized)) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (normalized === "pending_review") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (normalized === "paused") {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (normalized === "cancelled") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (normalized === "in_progress") {
    return "bg-indigo-100 text-indigo-800 border-indigo-200";
  }
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function formatScore(score: number | null, maxMarks: number | null) {
  if (score == null || maxMarks == null) return "—";
  return `${score} / ${maxMarks}`;
}

function formatPercentage(value: number | null) {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

function getPercentageColor(value: number | null) {
  if (value == null) return "text-slate-500";
  return value >= 50 ? "text-emerald-600" : "text-rose-600";
}

// Cleaner date formatting
function formatDate(isoString: string) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getHistoryAction(item: ExamHistoryItem) {
  const status = String(item.status).toLowerCase();

  if (status === "paused" || status === "in_progress") {
    return {
      href: `/exams/${item.exam_id}/start`,
      label: status === "paused" ? "Resume" : "Continue",
      disabled: false,
    };
  }

  if (["submitted", "evaluated", "reviewed", "pending_review"].includes(status)) {
    return {
      href: `/exams/${item.exam_id}/result`,
      label: "View result",
      disabled: false,
    };
  }

  return {
    href: "#",
    label: "Unavailable",
    disabled: true,
  };
}

export default function HistoryPage() {
  const [items, setItems] = useState<ExamHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getExamHistory();
        setItems(res.history);
      } catch (err: any) {
        setError(getApiErrorMessage(err, "Failed to load exam history."));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalExams = items.length;

  const percentageValues = useMemo(
    () =>
      items
        .map((item) => item.percentage)
        .filter((value): value is number => value != null),
    [items],
  );

  const averagePercentage = useMemo(() => {
    if (!percentageValues.length) return null;
    const total = percentageValues.reduce((sum, value) => sum + value, 0);
    return total / percentageValues.length;
  }, [percentageValues]);

  const reviewedCount = useMemo(() => {
    return items.filter((item) =>
      ["evaluated", "reviewed", "submitted"].includes(
        String(item.status).toLowerCase(),
      ),
    ).length;
  }, [items]);

  // FIX 1: Proper Skeleton Loader
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200"></div>
            <div className="h-4 w-64 animate-pulse rounded-lg bg-slate-100"></div>
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100"></div>
                <div className="h-8 w-16 animate-pulse rounded bg-slate-200"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="h-64 w-full animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <p className="font-medium text-rose-700">{error}</p>
        </div>
      </div>
    );
  }

  // FIX 2: Enhanced Empty State with a clear Call to Action
  if (!items.length) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-800">Exam History</h1>
          <p className="text-sm text-slate-500">
            Review your completed exams and results.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500">
            📊
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No exams yet</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            You haven&apos;t taken any exams. Create your first exam from a PDF or topic to start tracking your performance.
          </p>
          <Link
            href="/exams/create"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2"
          >
            Create your first exam
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-800">Exam History</h1>
            <p className="text-sm text-slate-500">
              Review your completed exams and performance summary.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Exams</p>
            <p className="text-2xl font-bold text-slate-800">{totalExams}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">
              Average Percentage
            </p>
            <p
              className={`text-2xl font-bold ${
                averagePercentage == null
                  ? "text-slate-500"
                  : averagePercentage >= 50
                    ? "text-emerald-600"
                    : "text-rose-600"
              }`}
            >
              {averagePercentage == null
                ? "—"
                : `${averagePercentage.toFixed(1)}%`}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">
              Reviewed / Evaluated
            </p>
            <p className="text-2xl font-bold text-slate-800">{reviewedCount}</p>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-slate-600">
              <th className="px-5 py-4 text-left font-semibold">Exam</th>
              <th className="px-5 py-4 text-left font-semibold">Score</th>
              <th className="px-5 py-4 text-left font-semibold">Percentage</th>
              <th className="px-5 py-4 text-left font-semibold">Status</th>
              <th className="px-5 py-4 text-left font-semibold">Completed at</th>
              <th className="px-5 py-4 text-right font-semibold">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const action = getHistoryAction(item);

              return (
                <tr
                  key={item.exam_id}
                  className="transition-colors hover:bg-slate-50/70"
                >
                  <td className="px-5 py-4 font-medium text-slate-800">
                    {item.exam_title}
                  </td>

                  <td className="px-5 py-4 text-slate-700">
                    {formatScore(item.final_score, item.max_marks)}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`font-semibold ${getPercentageColor(
                        item.percentage,
                      )}`}
                    >
                      {formatPercentage(item.percentage)}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${getStatusBadgeClass(
                        item.status,
                      )}`}
                    >
                      {String(item.status).replaceAll("_", " ").toUpperCase()}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(item.created_at)}
                  </td>

                  <td className="px-5 py-4 text-right">
                    {/* FIX 3: Added focus rings and active interaction states */}
                    <Link
                      href={action.href}
                      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-1 active:scale-95 ${
                        action.disabled
                          ? "pointer-events-none bg-slate-100 text-slate-400 border border-slate-200"
                          : "bg-slate-800 text-white hover:bg-slate-700"
                      }`}
                      aria-disabled={action.disabled}
                      tabIndex={action.disabled ? -1 : undefined}
                    >
                      {action.label}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-4 md:hidden">
        {items.map((item) => {
          const action = getHistoryAction(item);

          return (
            <div
              key={item.exam_id}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold leading-snug text-slate-800">
                  {item.exam_title}
                </h2>

                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${getStatusBadgeClass(
                    item.status,
                  )}`}
                >
                  {String(item.status).replaceAll("_", " ").toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-100">
                <div>
                  <p className="text-xs font-medium text-slate-500">Score</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-800">
                    {item.final_score == null ? "—" : item.final_score}
                    <span className="text-sm text-slate-400">
                      {" "}
                      / {item.max_marks == null ? "—" : item.max_marks}
                    </span>
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Percentage
                  </p>
                  <p
                    className={`mt-0.5 text-lg font-bold ${getPercentageColor(
                      item.percentage,
                    )}`}
                  >
                    {formatPercentage(item.percentage)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500">
                  Completed at
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDate(item.created_at)}
                </p>
              </div>

              <Link
                href={action.href}
                className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-1 active:scale-95 ${
                  action.disabled
                    ? "pointer-events-none bg-slate-100 text-slate-400 border border-slate-200"
                    : "bg-slate-800 text-white hover:bg-slate-700"
                }`}
                aria-disabled={action.disabled}
                tabIndex={action.disabled ? -1 : undefined}
              >
                {action.label}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}