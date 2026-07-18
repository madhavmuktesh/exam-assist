import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Exam Assistant",
  description: "AI-powered exam assistant",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}