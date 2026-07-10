"use client";

export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="panel mx-auto mt-12 max-w-xl rounded-md p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--danger)]">Ошибка раздела</p>
      <h1 className="mt-2 text-xl font-bold">Не удалось получить данные</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{error.message || "SQLite не изменён. Повторите запрос."}</p>
      <button type="button" className="btn mt-5" onClick={reset}>Повторить</button>
    </div>
  );
}
