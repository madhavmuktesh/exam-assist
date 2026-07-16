// frontend/src/app/(dashboard)/exams/[examId]/layout.tsx
import type { ReactNode } from "react";

export default function ExamLayout({
  children,
}: {
  children: ReactNode;
}) {
  // No <html> or <body> here; those are only in root layout.
  return <>{children}</>;
}