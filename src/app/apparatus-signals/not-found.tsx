import Link from "next/link";
import { BASE } from "@/apparatus-signals/lib/site";

export default function NotFound() {
  return (
    <div className="space-y-3 py-8">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="max-w-2xl text-as-ink-2">
        There is no state or department at this address. State pages use the two-letter code, such
        as <Link href={`${BASE}/ny`}>{BASE}/ny</Link>.
      </p>
      <p>
        <Link href={BASE}>Back to the map</Link>
      </p>
    </div>
  );
}
