import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/pica/components/kit";
import { DoneScreen } from "@/pica/features/decision/DoneScreen";

export const metadata: Metadata = { title: "Your decision · Pica" };

export default function DonePage({ params }: PageProps<"/projects/pica/d/[id]/done">) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 pt-3" aria-busy="true">
          <h1 className="sr-only">Your decision</h1>
          <Skeleton className="h-11 rounded-pill" />
          <Skeleton className="h-64 rounded-card" />
        </main>
      }
    >
      <DoneScreen params={params} />
    </Suspense>
  );
}
