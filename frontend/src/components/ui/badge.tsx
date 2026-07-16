import { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-zinc-100 text-zinc-600",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  error:   "bg-red-50 text-red-700",
  info:    "bg-blue-50 text-blue-700",
};

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        text-xs font-medium rounded-full
        ${variantClasses[variant]} ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}