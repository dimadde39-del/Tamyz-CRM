import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

function pageHref(current: URLSearchParams, page: number) {
  const params = new URLSearchParams(current);
  params.set("page", String(page));
  return `?${params.toString()}`;
}

export function Pagination({
  page,
  pageSize,
  total,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value) query.set(key, value);
  });

  return (
    <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-3 text-[12px]">
      <p className="text-[var(--muted)]">
        Страница {page} из {pages} · {total} записей
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="btn min-h-8 px-2" href={pageHref(query, page - 1)} aria-label="Предыдущая страница">
            <ChevronLeft aria-hidden="true" size={15} />
          </Link>
        ) : (
          <span className="btn min-h-8 px-2" aria-disabled="true">
            <ChevronLeft aria-hidden="true" size={15} />
          </span>
        )}
        {page < pages ? (
          <Link className="btn min-h-8 px-2" href={pageHref(query, page + 1)} aria-label="Следующая страница">
            <ChevronRight aria-hidden="true" size={15} />
          </Link>
        ) : (
          <span className="btn min-h-8 px-2" aria-disabled="true">
            <ChevronRight aria-hidden="true" size={15} />
          </span>
        )}
      </div>
    </div>
  );
}
