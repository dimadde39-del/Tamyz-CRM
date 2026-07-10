import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel mx-auto mt-12 max-w-xl rounded-md p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">404</p>
      <h1 className="mt-2 text-xl font-bold">Запись не найдена</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Возможно, контакт был удалён или ссылка устарела.</p>
      <Link href="/" className="btn mt-5">
        На главную
      </Link>
    </div>
  );
}
