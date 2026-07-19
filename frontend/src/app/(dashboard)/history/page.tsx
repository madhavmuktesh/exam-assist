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

  if (
    normalized === "evaluated" ||
    normalized === "reviewed" ||
    normalized === "submitted"
  ) {
    return "bg-green-100 text-green-700";
  }

  if (normalized === "pending_review") {
    return "bg-amber-100 text-amber-700";
  }

  if (normalized === "paused") {
    return "bg-blue-100 text-blue-700";
  }

  if (normalized === "cancelled") {
    return "bg-red-100 text-red-700";
  }

  if (normalized === "in_progress") {
    return "bg-indigo-100 text-indigo-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatScore(score: number | null, maxMarks: number | null) {
  if (score == null || maxMarks == null) {
    return "—";
  }

  return `${score} / ${maxMarks}`;
}

function formatPercentage(value: number | null) {
  if (value == null) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
}

function getPercentageColor(value: number | null) {
  if (value == null) {
    return "text-slate-500";
  }

  return value >= 50 ? "text-green-600" : "text-red-600";
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

  if (
    status === "submitted" ||
    status === "evaluated" ||
    status === "reviewed" ||
    status === "pending_review"
  ) {
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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">Loading history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="font-medium text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-800">Exam History</h1>
          <p className="text-sm text-slate-500">
            Review your completed exams and results.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">
            You have not completed any exams yet.
          </p>
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
                    ? "text-green-600"
                    : "text-red-600"
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

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-slate-600">
              <th className="px-4 py-3 text-left font-semibold">Exam</th>
              <th className="px-4 py-3 text-left font-semibold">Score</th>
              <th className="px-4 py-3 text-left font-semibold">Percentage</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Completed at</th>
              <th className="px-4 py-3 text-left font-semibold">Action</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => {
              const action = getHistoryAction(item);

              return (
                <tr
                  key={item.exam_id}
                  className="border-t border-slate-200 transition-colors hover:bg-slate-50/70"
                >
                  <td className="px-4 py-4 font-medium text-slate-800">
                    {item.exam_title}
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {formatScore(item.final_score, item.max_marks)}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`font-semibold ${getPercentageColor(
                        item.percentage,
                      )}`}
                    >
                      {formatPercentage(item.percentage)}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                        item.status,
                      )}`}
                    >
                      {String(item.status).replaceAll("_", " ").toUpperCase()}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {new Date(item.created_at).toLocaleString()}
                  </td>

                  <td className="px-4 py-4">
                    <Link
                      href={action.href}
                      className={`inline-flex items-center rounded-lg px-4 py-2 font-medium shadow-sm transition-colors ${
                        action.disabled
                          ? "pointer-events-none bg-slate-200 text-slate-500"
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
                  className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                    item.status,
                  )}`}
                >
                  {String(item.status).replaceAll("_", " ").toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Score</p>
                  <p className="text-lg font-bold text-slate-800">
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
                    className={`text-lg font-bold ${getPercentageColor(
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
                <p className="mt-1 text-sm text-slate-600">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>

              <Link
                href={action.href}
                className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 font-medium shadow-sm transition-colors ${
                  action.disabled
                    ? "pointer-events-none bg-slate-200 text-slate-500"
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