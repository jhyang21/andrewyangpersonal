import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/pica/components/kit";
import { DecideScreen } from "@/pica/features/decide/DecideScreen";

export const metadata: Metadata = { title: "Decide · Pica" };

export default function DecidePage({ params, searchParams }: PageProps<"/projects/pica/d/[id]/decide">) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-[640px] flex-col gap-3 px-4 pt-3" aria-busy="true">
          <h1 className="sr-only">Decide</h1>
          <Skeleton className="h-11 rounded-pill" />
          <Skeleton className="h-64 rounded-card" />
        </main>
      }
    >
      <DecideScreen params={params} searchParams={searchParams} />
    </Suspense>
  );
}
