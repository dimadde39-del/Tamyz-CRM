import { Search } from "lucide-react";
import Link from "next/link";

const statuses = [
  "не начато",
  "сообщение отправлено",
  "автоответ",
  "передали менеджеру",
  "регион свободен",
  "регион закрыт",
  "обсуждение условий",
  "квалифицирован",
  "отказ",
  "follow-up",
  "закрыт",
];

export function SupplierFilters({
  values,
  action = "/suppliers",
}: {
  values: Record<string, string | undefined>;
  action?: string;
}) {
  return (
    <form action={action} method="get" className="grid gap-2 p-3 md:grid-cols-[minmax(230px,1.4fr)_repeat(4,minmax(135px,0.7fr))_auto]">
      <label className="relative">
        <span className="sr-only">Поиск</span>
        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={15} />
        <input className="field pl-9" type="search" name="q" defaultValue={values.q} placeholder="Название, город, телефон…" />
      </label>
      <label>
        <span className="sr-only">Статус</span>
        <select className="field" name="status" defaultValue={values.status ?? ""}>
          <option value="">Все статусы</option>
          {statuses.map((status) => (
            <option value={status} key={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Приоритет</span>
        <select className="field" name="priority" defaultValue={values.priority ?? ""}>
          <option value="">Все приоритеты</option>
          <option value="высокий">высокий</option>
          <option value="средний">средний</option>
          <option value="низкий">низкий</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Ответственный</span>
        <select className="field" name="owner" defaultValue={values.owner ?? ""}>
          <option value="">Все ответственные</option>
          <option value="Димаш">Димаш</option>
          <option value="Ерасыл">Ерасыл</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Итог квалификации</span>
        <select className="field" name="qualification" defaultValue={values.qualification ?? ""}>
          <option value="">Любой итог</option>
          <option value="green">зелёный</option>
          <option value="yellow">жёлтый</option>
          <option value="red">красный</option>
        </select>
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary grow" type="submit">
          Найти
        </button>
        <Link className="btn px-3" href={action} aria-label="Сбросить фильтры">
          ×
        </Link>
      </div>
    </form>
  );
}
