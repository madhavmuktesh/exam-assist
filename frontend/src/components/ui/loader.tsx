interface LoaderProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Loader({ size = "md", label = "Loading..." }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" role="status" aria-label={label}>
      <svg
        className={`animate-spin text-primary ${sizeClasses[size]}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      {label && <span className="text-sm text-zinc-400">{label}</span>}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <Loader size="lg" label="Loading..." />
    </div>
  );
}