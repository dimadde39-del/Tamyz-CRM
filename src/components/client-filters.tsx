import { Search } from "lucide-react";
import Link from "next/link";

export function ClientFilters({ values }: { values: Record<string, string | undefined> }) {
  return (
    <form action="/clients" method="get" className="grid gap-2 p-3 md:grid-cols-[minmax(240px,1.4fr)_repeat(3,minmax(150px,0.7fr))_auto]">
      <label className="relative">
        <span className="sr-only">Поиск</span>
        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={15} />
        <input className="field pl-9" type="search" name="q" defaultValue={values.q} placeholder="Название, адрес, телефон…" />
      </label>
      <label>
        <span className="sr-only">Категория</span>
        <select className="field" name="category" defaultValue={values.category ?? ""}>
          <option value="">Все категории</option>
          <option value="автомойка">автомойка</option>
          <option value="детейлинг-центр">детейлинг-центр</option>
          <option value="клининговая компания">клининговая компания</option>
          <option value="мойка ковров / химчистка мебели">ковры / мебель</option>
          <option value="прачечная / химчистка">прачечная / химчистка</option>
          <option value="ресторан / кафе">ресторан / кафе</option>
          <option value="гостиница / хостел">гостиница / хостел</option>
          <option value="другой регулярный потребитель">другой</option>
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
      <div className="flex gap-2">
        <button className="btn btn-primary grow" type="submit">
          Найти
        </button>
        <Link className="btn px-3" href="/clients" aria-label="Сбросить фильтры">
          ×
        </Link>
      </div>
    </form>
  );
}
