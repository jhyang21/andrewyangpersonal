import Link from "next/link";
import { DEFAULT_SELECTION, scenarioKey } from "@/cup-notes/lib/levers";
import { BASE, runHref } from "@/cup-notes/lib/site";

export default function NotFound() {
  const example = runHref(scenarioKey(DEFAULT_SELECTION));
  return (
    <div className="space-y-3 py-8">
      <h1 className="text-3xl font-semibold">No run at this address</h1>
      <p className="max-w-2xl text-cn-muted">
        A run&rsquo;s address names its four levers in order: rule, note, traffic, staffing. For
        example <Link href={example}>{example}</Link>.
      </p>
      <p>
        <Link href={BASE}>Back to the runs</Link>
      </p>
    </div>
  );
}
