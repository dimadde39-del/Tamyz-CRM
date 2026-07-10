"use client";

import { FileUp, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";

type ImportReport = {
  runId: number;
  fileName: string;
  fileHash: string;
  suppliers: { total: number; created: number; updated: number; unchanged: number };
  clients: { total: number; created: number; updated: number; unchanged: number };
  errors: string[];
};

export function ImportForm() {
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function runImport(useBundledSource: boolean) {
    setPending(true);
    setError(null);
    setReport(null);
    try {
      const data = new FormData();
      const file = fileRef.current?.files?.[0];
      if (!useBundledSource && !file) {
        setError("Выберите XLSX или используйте встроенный исходный файл.");
        return;
      }
      if (file && !useBundledSource) data.set("file", file);
      const response = await fetch("/api/import", { method: "POST", body: data });
      const payload = (await response.json()) as { report?: ImportReport; error?: string };
      if (!response.ok || !payload.report) throw new Error(payload.error || "Импорт не выполнен");
      setReport(payload.report);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Импорт не выполнен");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-4">
      <label>
        <span className="label">XLSX для импорта</span>
        <input ref={fileRef} className="field file:mr-3 file:border-0 file:bg-transparent file:text-[12px] file:font-semibold" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-primary" type="button" disabled={pending} onClick={() => runImport(false)}><FileUp aria-hidden="true" size={15} />{pending ? "Импортирую…" : "Импортировать выбранный"}</button>
        <button className="btn" type="button" disabled={pending} onClick={() => runImport(true)}><RefreshCw aria-hidden="true" size={15} />Повторить исходный импорт</button>
      </div>
      <p className="mt-3 text-[11px] leading-4 text-[var(--muted)]">Повторный импорт обновляет только поля источника. Статусы, ответы, ответственные, follow-up и журнал не перезаписываются.</p>
      {error ? <div className="mt-4 rounded border border-[#e5bcb6] bg-[var(--danger-soft)] p-3 text-[12px] text-[var(--danger)]" role="alert">{error}</div> : null}
      {report ? (
        <div className="mt-4 rounded border border-[#b8d1c2] bg-[var(--accent-soft)] p-3 text-[12px] text-[#1e5b43]" role="status">
          <p className="font-bold">Импорт #{report.runId} завершён</p>
          <p className="mt-1">Поставщики: {report.suppliers.total} · создано {report.suppliers.created} · обновлено {report.suppliers.updated} · без изменений {report.suppliers.unchanged}</p>
          <p>Клиенты: {report.clients.total} · создано {report.clients.created} · обновлено {report.clients.updated} · без изменений {report.clients.unchanged}</p>
          <p className="mt-1 font-mono text-[10px]">SHA-256: {report.fileHash}</p>
        </div>
      ) : null}
    </div>
  );
}
