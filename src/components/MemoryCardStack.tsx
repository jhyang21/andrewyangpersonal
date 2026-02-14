import { Card } from "@/components/Card";

const memoryItems = [
  "met at: coffee chat",
  "asked about: grad school",
  "follow up: next friday",
  "gift idea: matcha whisk",
];

export function MemoryCardStack() {
  return (
    <div className="relative min-h-[340px] w-full">
      <Card className="absolute left-4 top-5 w-[84%] rotate-[-3deg] p-4" fold>
        <p className="text-sm text-[var(--color-muted)]">upcoming</p>
        <p className="mt-2 font-medium text-[var(--color-ink)]">Call with Maya tomorrow, 10:00 AM</p>
      </Card>
      <Card className="absolute right-0 top-14 w-[86%] rotate-[2deg] p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="size-9 rounded-full bg-[var(--color-secondary-tint)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">Maya Chen</p>
            <p className="text-xs text-[var(--color-muted)]">Product coffee chat</p>
          </div>
        </div>
        <ul className="space-y-2">
          {memoryItems.map((item) => (
            <li key={item} className="rounded-xl bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)]">
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
