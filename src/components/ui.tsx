import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "border-[#cfd2ca] bg-[#f0f1ec] text-[#50564f]",
  success: "border-[#b8d1c2] bg-[var(--accent-soft)] text-[#1e5b43]",
  warning: "border-[#e2cc98] bg-[var(--warning-soft)] text-[#795711]",
  danger: "border-[#e5bcb6] bg-[var(--danger-soft)] text-[#8f382f]",
  info: "border-[#bccfdf] bg-[var(--info-soft)] text-[#315776]",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-[680] leading-4 ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-[var(--line-strong)] pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">{eyebrow}</p> : null}
        <h1 className="text-[25px] font-[760] tracking-[-0.025em] text-[var(--ink)]">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-[13px] text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel rounded-md ${className}`}>
      {title || actions ? (
        <div className="flex flex-col gap-2 border-b border-[var(--line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title ? <h2 className="text-[14px] font-[720] tracking-[-0.01em]">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[12px] text-[var(--muted)]">{description}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  return (
    <div className="panel rounded-md p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-[680] uppercase tracking-[0.055em] text-[var(--muted)]">{label}</p>
        {Icon ? <Icon aria-hidden="true" className={toneClass[tone].split(" ").at(-1)} size={16} strokeWidth={1.8} /> : null}
      </div>
      <p className="mt-2 text-[27px] font-[760] leading-none tracking-[-0.035em]">{value}</p>
      {detail ? <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">{detail}</p> : null}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="font-semibold text-[var(--ink)]">{title}</p>
      {detail ? <p className="mt-1 text-[12px] text-[var(--muted)]">{detail}</p> : null}
    </div>
  );
}
