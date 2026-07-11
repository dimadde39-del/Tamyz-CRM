import { Badge } from "@/components/ui";

const statusTone = {
  "не начато": "neutral",
  "сообщение отправлено": "info",
  автоответ: "warning",
  "передали менеджеру": "warning",
  "регион свободен": "success",
  "регион закрыт": "danger",
  "обсуждение условий": "warning",
  квалифицирован: "success",
  отказ: "danger",
  "follow-up": "info",
  закрыт: "danger",
  черновик: "neutral",
  "ожидает подтверждения": "warning",
  подтверждён: "success",
  "уже является клиентом поставщика": "danger",
  "условия отклонены": "danger",
  "стороны познакомлены": "success",
  "черновик условий": "warning",
  "условия подтверждены": "success",
} as const;

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={(statusTone[status as keyof typeof statusTone] ?? "neutral") as BadgeTone}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tone = priority === "высокий" ? "danger" : priority === "средний" ? "warning" : "neutral";
  return <Badge tone={tone}>{priority}</Badge>;
}

export function QualificationBadge({ result }: { result: "green" | "yellow" | "red" | string }) {
  if (result === "green") return <Badge tone="success">Зелёный · схема проходит</Badge>;
  if (result === "red") return <Badge tone="danger">Красный · стоп-фактор</Badge>;
  return <Badge tone="warning">Жёлтый · данных недостаточно</Badge>;
}

export function TriStateBadge({ value }: { value: string | null | undefined }) {
  if (value === "yes") return <Badge tone="success">Да</Badge>;
  if (value === "no") return <Badge tone="danger">Нет</Badge>;
  return <Badge tone="neutral">Неизвестно</Badge>;
}
