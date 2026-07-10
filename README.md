# TAMYZ Ops v0.1

Минимальная операционная CRM для 48-часовой проверки агентской B2B-микродистрибуции профессиональной химии в Шымкенте.

Система не отправляет сообщения автоматически. Она формирует очередь, открывает ручной `wa.me`, сохраняет ответы, квалификацию, follow-up и историю действий.

## Стек

- Next.js 16 App Router, React 19, TypeScript 5
- Tailwind CSS 4
- SQLite (`better-sqlite3`) + Drizzle ORM
- ExcelJS для идемпотентного импорта XLSX
- Vitest и Playwright

## Быстрый запуск

```bash
npm install
npm run dev
```

Перед `dev`, `build` и `start` автоматически применяются миграции и повторно импортируется встроенный XLSX. Импорт идемпотентен: операторские статусы, ответы, комментарии и follow-up не перезаписываются.

Открыть: <http://localhost:3000>

## Команды

```bash
npm run db:setup     # миграции + исходный XLSX + КДС-Алматы
npm run lint
npm run typecheck
npm test             # unit + integration
npm run test:e2e     # отдельная E2E SQLite
npm run build
npm run check        # lint + typecheck + test + build
```

Если Playwright запускается впервые:

```bash
npx playwright install chromium
```

## Данные

Исходники сохранены в `data/source/`:

- `shymkent_prof_chem_contacts.xlsx` — 61 поставщик и 250 клиентов;
- `shymkent_prof_chem_agent_test.md`;
- `TAMYZ_FULL_HANDOFF_DISTRIBUTION.md`.

Идентичность поставщика определяется `duplicate_group`, клиента — уникальным 2GIS firm id. Название и телефон не используются как единственный ключ: филиалы с одинаковыми именами сохраняются отдельно.

Рабочая база по умолчанию: `data/tamyz-ops.db`. Путь можно изменить через `DATABASE_URL`.

## Разделы

- `/` — «Сегодня», метрики и kill/continue gates;
- `/pipeline` — ручной контактный конвейер;
- `/suppliers` и `/suppliers/[id]` — поиск, фильтры, ответ, квалификация, follow-up;
- `/clients` и `/clients/[id]` — неактивированная база и реальные корзины;
- `/activities` — журнал переходов и ответов;
- `/data` — повторный импорт, отчёт и CSV-экспорт.

## Границы v0.1

Сознательно отсутствуют авторизация, WhatsApp API, массовая рассылка, склад, бухгалтерия, платежи, покупательский каталог, комиссия/поставка как отдельные сущности и автономный AI-бот. Эти модули не нужны до первой подтверждённой агентской схемы и реальной сделки.
