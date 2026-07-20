import "./globals.css";
import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useauth"; // 1. Import the new provider

export const metadata = {
  title: "Exam Assistant",
  description: "AI-powered exam assistant",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        {/* 2. Wrap the entire app so auth state is shared everywhere */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}