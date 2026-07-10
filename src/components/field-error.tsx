export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-[11px] font-medium text-[var(--danger)]">{children}</p>;
}
