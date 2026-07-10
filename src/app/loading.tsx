export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Загрузка">
      <div className="h-16 rounded bg-black/7" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-28 rounded bg-black/7" />
        ))}
      </div>
      <div className="h-80 rounded bg-black/7" />
    </div>
  );
}
