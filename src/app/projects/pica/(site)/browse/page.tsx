import type { Metadata } from "next";
import { Suspense } from "react";
import { BrowseScreen, BrowseSkeleton } from "@/pica/features/browse/BrowseScreen";

export const metadata: Metadata = { title: "Browse · Pica" };

export default function BrowsePage({ searchParams }: PageProps<"/projects/pica/browse">) {
  return (
    <Suspense
      fallback={
        <main aria-busy="true" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-12">
          <BrowseSkeleton />
        </main>
      }
    >
      <BrowseScreen searchParams={searchParams} />
    </Suspense>
  );
}
