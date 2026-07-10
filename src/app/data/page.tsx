import { desc } from "drizzle-orm";
import { Download } from "lucide-react";
import type { Metadata } from "next";

import { ImportForm } from "@/components/import-form";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { db } from "@/db/client";
import { importRuns } from "@/db/schema";
import { formatBusinessDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Импорт и экспорт" };
export const dynamic = "force-dynamic";

export default function DataPage() {
  const runs = db.select().from(importRuns).orderBy(desc(importRuns.startedAt)).limit(12).all();
  const latest = runs[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Источник и переносимость"
        title="Импорт и экспорт"
        description="Контакты импортируются по устойчивым внешним ключам; одинаковые названия филиалов не склеиваются."
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Panel title="Импорт XLSX" description="Ожидаются листы ПОСТАВЩИКИ и КЛИЕНТЫ.">
          <ImportForm />
        </Panel>
        <Panel title="Экспорт CSV" description="UTF-8 с BOM — открывается в Excel без потери кириллицы.">
          <div className="grid gap-2 p-4">
            <a className="btn justify-between" href="/api/export/suppliers"><span>Поставщики</span><Download aria-hidden="true" size={15} /></a>
            <a className="btn justify-between" href="/api/export/clients"><span>Клиенты</span><Download aria-hidden="true" size={15} /></a>
            <a className="btn justify-between" href="/api/export/activities"><span>Журнал действий</span><Download aria-hidden="true" size={15} /></a>
            <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">Экспорт сохраняет полные `source_url`, исходные ответы и операционные поля.</p>
          </div>
        </Panel>
      </div>

      {latest ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="panel rounded-md p-4"><p className="label">Последний импорт</p><p className="text-[15px] font-semibold">{latest.fileName}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{formatBusinessDateTime(latest.finishedAt ?? latest.startedAt)}</p></div>
          <div className="panel rounded-md p-4"><p className="label">Поставщики</p><p className="text-[22px] font-bold">{latest.suppliersCreated + latest.suppliersUpdated + latest.suppliersUnchanged}</p><p className="mt-1 text-[11px] text-[var(--muted)]">+{latest.suppliersCreated} / Δ{latest.suppliersUpdated} / ={latest.suppliersUnchanged}</p></div>
          <div className="panel rounded-md p-4"><p className="label">Клиенты</p><p className="text-[22px] font-bold">{latest.clientsCreated + latest.clientsUpdated + latest.clientsUnchanged}</p><p className="mt-1 text-[11px] text-[var(--muted)]">+{latest.clientsCreated} / Δ{latest.clientsUpdated} / ={latest.clientsUnchanged}</p></div>
        </div>
      ) : null}

      <Panel title="История импортов" className="mt-4 overflow-hidden">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="data-table min-w-[860px]">
            <thead><tr><th>Дата</th><th>Файл</th><th>Статус</th><th>Поставщики + / Δ / =</th><th>Клиенты + / Δ / =</th><th>SHA-256</th></tr></thead>
            <tbody>{runs.map((run) => <tr key={run.id}><td>{formatBusinessDateTime(run.finishedAt ?? run.startedAt)}</td><td>{run.fileName}</td><td><Badge tone={run.status === "completed" ? "success" : run.status === "failed" ? "danger" : "warning"}>{run.status}</Badge></td><td>{run.suppliersCreated} / {run.suppliersUpdated} / {run.suppliersUnchanged}</td><td>{run.clientsCreated} / {run.clientsUpdated} / {run.clientsUnchanged}</td><td className="max-w-[260px] truncate font-mono text-[10px]">{run.fileHash}</td></tr>)}{runs.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-[var(--muted)]">Импортов ещё не было.</td></tr> : null}</tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
