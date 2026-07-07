// frontend/src/app/(auth)/layout.tsx
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  // No <html> or <body> here. Just wrap within the existing body.
  return <>{children}</>;
}