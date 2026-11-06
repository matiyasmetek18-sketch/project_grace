export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="currentColor" />
      <path d="M24 36V14" stroke="#f6f1e6" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M24 27c7-2 9-9 9-9-5 1-9 4.5-9 9z" fill="#e6c27a" />
      <path d="M24 22c-8-1-10-9-10-9 5 1.2 9 4.5 10 9z" fill="#f6f1e6" />
      <circle cx="24" cy="13.5" r="2.1" fill="#c46a3a" />
    </svg>
  );
}
